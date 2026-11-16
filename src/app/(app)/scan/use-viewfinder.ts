"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { LabelBarcodes } from "@/lib/label/barcodes";
import { CAMERA_CONSTRAINTS, cameraProblem, frameSize } from "@/lib/label/camera";
import { decideFrame, trimHistory, type FrameHint, type FrameRead } from "@/lib/label/frame-quality";
import type { FrameReply, FrameRequest } from "@/lib/label/frame-worker";

export type CameraState = "starting" | "live" | "unsupported" | "denied" | "failed";

const NO_CODES: LabelBarcodes = { upc: null, serial: null, product_code: null };
/** About 5 frames each second. A slow phone reads fewer: the next frame waits for the last reply. */
const FRAME_GAP_MS = 200;

/** The torch and the focus mode are camera capabilities that the DOM types do not list yet. */
type CameraCapabilities = MediaTrackCapabilities & { torch?: boolean; focusMode?: string[] };

/** Draws the current video frame on a canvas at the reader size. */
function drawFrame(video: HTMLVideoElement, canvas: HTMLCanvasElement) {
  const { width, height } = frameSize(video.videoWidth, video.videoHeight);
  if (canvas.width !== width) canvas.width = width;
  if (canvas.height !== height) canvas.height = height;
  const context = canvas.getContext("2d", { willReadFrequently: true })!;
  context.drawImage(video, 0, 0, width, height);
  return context;
}

const toFile = (canvas: HTMLCanvasElement) =>
  new Promise<File | null>((resolve) =>
    canvas.toBlob((blob) => resolve(blob && new File([blob], "label.jpg", { type: "image/jpeg" })), "image/jpeg", 0.92),
  );

/**
 * The live camera of the scan. It reads frames in a worker and calls `onCapture` when a frame
 * gives the UPC and the serial two times in a row. The camera stops when the page is hidden
 * and when the component that uses the hook goes away.
 */
export function useViewfinder({
  onCapture,
  skipSerials = [],
}: {
  onCapture: (file: File, codes: LabelBarcodes) => void;
  /** Serial numbers that must not capture again, for example the balls already in a batch. */
  skipSerials?: readonly string[];
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [state, setState] = useState<CameraState>("starting");
  const [hint, setHint] = useState<FrameHint>("aim");
  const [codes, setCodes] = useState<LabelBarcodes>(NO_CODES);
  const [torch, setTorch] = useState({ available: false, on: false });

  const onCaptureRef = useRef(onCapture);
  const skipRef = useRef(skipSerials);
  useEffect(() => {
    onCaptureRef.current = onCapture;
    skipRef.current = skipSerials;
  });

  const streamRef = useRef<MediaStream | null>(null);
  const torchOn = useRef(false);

  useEffect(() => {
    let stopped = false;
    let session = 0;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let history: FrameRead[] = [];
    // Serials captured in this viewfinder. The parent list can update later than the next frame.
    const captured = new Set<string>();
    const canvas = document.createElement("canvas");
    const worker = new Worker(new URL("../../../lib/label/frame-worker.ts", import.meta.url), { type: "module" });
    let nextId = 0;
    const pending = new Map<number, (reply: FrameReply) => void>();
    worker.onmessage = (event: MessageEvent<FrameReply>) => {
      pending.get(event.data.id)?.(event.data);
      pending.delete(event.data.id);
    };
    const read = (frame: ImageData) =>
      new Promise<FrameReply>((resolve) => {
        const id = nextId++;
        pending.set(id, resolve);
        const request: FrameRequest = { id, data: frame.data, width: frame.width, height: frame.height };
        worker.postMessage(request, [frame.data.buffer]);
      });

    function stopCamera() {
      session++;
      clearTimeout(timer);
      streamRef.current?.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
      torchOn.current = false;
      if (videoRef.current) videoRef.current.srcObject = null;
    }

    async function tick(mine: number) {
      const video = videoRef.current;
      if (stopped || mine !== session || !video) return;
      if (video.readyState < 2 || !video.videoWidth) {
        timer = setTimeout(() => tick(mine), 100);
        return;
      }
      const started = performance.now();
      const context = drawFrame(video, canvas);
      const reply = await read(context.getImageData(0, 0, canvas.width, canvas.height));
      if (stopped || mine !== session) return;

      if ("result" in reply) {
        const now = performance.now();
        history = trimHistory([...history, { at: now, ...reply.result }], now);
        const decision = decideFrame(history, now, [...skipRef.current, ...captured]);
        setCodes(reply.result.codes);
        setHint(decision.hint);
        if (decision.capture) {
          const serial = reply.result.codes.serial!;
          captured.add(serial);
          history = [];
          // The canvas still holds the frame that the worker read.
          const file = await toFile(canvas);
          if (stopped || mine !== session) return;
          if (file) {
            navigator.vibrate?.(30);
            onCaptureRef.current(file, reply.result.codes);
          }
        }
      }
      timer = setTimeout(() => tick(mine), Math.max(0, FRAME_GAP_MS - (performance.now() - started)));
    }

    async function startCamera() {
      if (!navigator.mediaDevices?.getUserMedia) {
        setState("unsupported");
        return;
      }
      const mine = ++session;
      setState("starting");
      try {
        const stream = await navigator.mediaDevices.getUserMedia(CAMERA_CONSTRAINTS);
        if (stopped || mine !== session) {
          stream.getTracks().forEach((track) => track.stop());
          return;
        }
        streamRef.current = stream;
        const track = stream.getVideoTracks()[0] as MediaStreamTrack | undefined;
        const capabilities = track?.getCapabilities?.() as CameraCapabilities | undefined;
        // Keep the focus moving on browsers that let a page set it. Others do this by default.
        if (capabilities?.focusMode?.includes("continuous")) {
          track!.applyConstraints({ advanced: [{ focusMode: "continuous" } as MediaTrackConstraintSet] }).catch(() => {});
        }
        setTorch({ available: Boolean(capabilities?.torch), on: false });
        const video = videoRef.current!;
        video.srcObject = stream;
        await video.play().catch(() => {});
        history = [];
        setHint("aim");
        setState("live");
        tick(mine);
      } catch (error) {
        if (!stopped && mine === session) setState(cameraProblem(error));
      }
    }

    // An open camera uses the battery and keeps the camera light on. Stop it when the page is hidden.
    const onVisibility = () => {
      if (document.hidden) stopCamera();
      else void startCamera();
    };
    document.addEventListener("visibilitychange", onVisibility);
    void startCamera();

    return () => {
      stopped = true;
      document.removeEventListener("visibilitychange", onVisibility);
      stopCamera();
      worker.terminate();
    };
  }, []);

  const toggleTorch = useCallback(async () => {
    const track = streamRef.current?.getVideoTracks()[0];
    if (!track) return;
    const next = !torchOn.current;
    try {
      await track.applyConstraints({ advanced: [{ torch: next } as MediaTrackConstraintSet] });
      torchOn.current = next;
      setTorch({ available: true, on: next });
    } catch {
      setTorch({ available: false, on: false });
    }
  }, []);

  /** Captures the current frame without the barcode checks. The normal photo read runs on it. */
  const shutter = useCallback(async () => {
    const video = videoRef.current;
    if (!video || !video.videoWidth) return;
    const canvas = document.createElement("canvas");
    drawFrame(video, canvas);
    const file = await toFile(canvas);
    if (file) onCaptureRef.current(file, NO_CODES);
  }, []);

  return { videoRef, state, hint, codes, torch, toggleTorch, shutter };
}
