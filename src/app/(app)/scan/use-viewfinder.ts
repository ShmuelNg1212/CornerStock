"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { NO_CODES, type LabelBarcodes } from "@/lib/label/barcodes";
import { CAMERA_CONSTRAINTS, cameraProblem, frameSize } from "@/lib/label/camera";
import { decideFrame, FRAME_LIMITS, trimHistory, type FrameHint, type FrameRead } from "@/lib/label/frame-quality";
import type { FrameReply, FrameRequest } from "@/lib/label/frame-worker";

export type CameraState = "starting" | "live" | "unsupported" | "denied" | "failed";

/** A frame read that takes longer than this counts as failed. A phone reads one in well under a second. */
const READ_TIMEOUT_MS = 5000;
/** A camera that gives no picture for this long after the start counts as failed. */
const PICTURE_TIMEOUT_MS = 5000;
/** About 5 frames each second. A slow phone reads fewer: the next frame waits for the last reply. */
const FRAME_GAP_MS = 200;

/** The values of the diagnostic panel (`?debug=1`). They stay on the device. */
export type ViewfinderStats = {
  /** The size that the camera gives, from the track settings. */
  stream: string;
  /** The size of the frame that the reader reads. */
  frame: string;
  readMs: number;
  readAvgMs: number;
  /** Frames read in the last second. */
  fps: number;
  sharpness: number;
  moduleSize: number | null;
  /** The codes of the last frame: U (UPC), S (serial), P (product code), or a dash. */
  read: string;
  /** The codes that read in any frame of the capture window, in the same form. */
  window: string;
  captures: number;
  /** From the first barcode after the start or the last capture, to the capture. */
  lastCaptureMs: number | null;
};

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
 * reads the UPC and the serial together,
 * and one more frame confirms the serial (see `decideFrame`). The camera stops when the page is hidden
 * and when the component that uses the hook goes away.
 */
export function useViewfinder({
  onCapture,
  skipSerials = [],
  debug = false,
}: {
  onCapture: (file: File, codes: LabelBarcodes) => void;
  /** Serial numbers that must not capture again, for example the balls already in a batch. */
  skipSerials?: readonly string[];
  /** Collect the values of the diagnostic panel. */
  debug?: boolean;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [state, setState] = useState<CameraState>("starting");
  const [hint, setHint] = useState<FrameHint>("aim");
  const [codes, setCodes] = useState<LabelBarcodes>(NO_CODES);
  const [torch, setTorch] = useState({ available: false, on: false });
  const [stats, setStats] = useState<ViewfinderStats | null>(null);
  const debugRef = useRef(debug);

  const onCaptureRef = useRef(onCapture);
  const skipRef = useRef(skipSerials);
  useEffect(() => {
    onCaptureRef.current = onCapture;
    skipRef.current = skipSerials;
    debugRef.current = debug;
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
    const settle = (reply: FrameReply) => {
      pending.get(reply.id)?.(reply);
      pending.delete(reply.id);
    };
    worker.onmessage = (event: MessageEvent<FrameReply>) => settle(event.data);
    // A worker that does not load, or that crashes, must not leave the loop waiting with no message.
    worker.onerror = () => {
      for (const id of [...pending.keys()]) settle({ id, error: "The frame reader stopped." });
      if (!stopped) {
        stopCamera();
        setState("failed");
      }
    };
    const read = (frame: ImageData) =>
      new Promise<FrameReply>((resolve) => {
        const id = nextId++;
        pending.set(id, resolve);
        setTimeout(() => settle({ id, error: "The frame read took too long." }), READ_TIMEOUT_MS);
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

    let liveSince = 0;
    // Diagnostic values. They change no decision.
    let readAvg = 0;
    let captures = 0;
    let firstCodeAt: number | null = null;
    let lastCaptureMs: number | null = null;
    const readTimes: number[] = [];
    async function tick(mine: number) {
      const video = videoRef.current;
      if (stopped || mine !== session || !video) return;
      if (video.readyState < 2 || !video.videoWidth) {
        // The video can fail to play, for example in Low Power Mode on an iPhone.
        if (performance.now() - liveSince > PICTURE_TIMEOUT_MS) {
          stopCamera();
          setState("failed");
          return;
        }
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

        if (debugRef.current) {
          const { codes: frameCodes } = reply.result;
          if (firstCodeAt === null && (frameCodes.upc || frameCodes.serial || frameCodes.product_code)) firstCodeAt = now;
          if (decision.capture) {
            captures++;
            lastCaptureMs = firstCodeAt === null ? null : Math.round(now - firstCodeAt);
            firstCodeAt = null;
          }
          // The draw and the read, as one frame costs.
          const readMs = now - started;
          const inWindow = history.filter((f) => f.at >= now - FRAME_LIMITS.captureWindowMs).map((f) => f.codes);
          const marks = (list: LabelBarcodes[]) =>
            `${list.some((c) => c.upc) ? "U" : "-"}${list.some((c) => c.serial) ? "S" : "-"}${list.some((c) => c.product_code) ? "P" : "-"}`;
          readAvg = readAvg ? readAvg * 0.8 + readMs * 0.2 : readMs;
          readTimes.push(now);
          while (readTimes[0] < now - 1000) readTimes.shift();
          const settings = streamRef.current?.getVideoTracks()[0]?.getSettings();
          setStats({
            stream: settings?.width ? `${settings.width} × ${settings.height}` : `${video.videoWidth} × ${video.videoHeight}`,
            frame: `${canvas.width} × ${canvas.height}`,
            readMs: Math.round(readMs),
            readAvgMs: Math.round(readAvg),
            fps: readTimes.length,
            sharpness: Math.round(reply.result.sharpness),
            moduleSize: reply.result.moduleSize,
            read: marks([frameCodes]),
            window: marks(inWindow),
            captures,
            lastCaptureMs,
          });
        }

        if (decision.capture) {
          // The combined codes of the capture window. The latest frame read the serial.
          const capturedCodes = decision.codes;
          captured.add(capturedCodes.serial!);
          history = [];
          // The canvas still holds the frame that the worker read.
          const file = await toFile(canvas);
          if (stopped || mine !== session) return;
          if (file) {
            navigator.vibrate?.(30);
            onCaptureRef.current(file, capturedCodes);
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
      // A second start without a stop before it must not leave the first stream open.
      stopCamera();
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
        if (stopped || mine !== session) return;
        history = [];
        firstCodeAt = null;
        liveSince = performance.now();
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

  return { videoRef, state, hint, codes, torch, toggleTorch, shutter, stats: debug ? stats : null };
}
