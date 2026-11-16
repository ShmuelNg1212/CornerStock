export type StaffRole = "owner" | "staff";
export type BallStatus = "in_stock" | "sold" | "removed";
export type MovementType = "receive" | "sell" | "reverse_sale" | "transfer" | "adjust" | "remove";

export type Profile = { id: string; full_name: string; role: StaffRole; active: boolean };
export type Location = { id: string; name: string; active: boolean };

export type BallModel = {
  id: string;
  upc: string;
  brand: string | null;
  name: string;
  nominal_weight_lb: number;
  color: string | null;
  fragrance: string | null;
  coverstock: string | null;
  weight_block: string | null;
  finish: string | null;
  rg: number | null;
  diff: number | null;
  mass_bias: number | null;
  product_code: string | null;
  selling_price: number | null;
};

export type Ball = {
  id: string;
  serial: string;
  model_id: string;
  location_id: string;
  status: BallStatus;
  gross_weight_oz: number | null;
  top_weight: number | null;
  pin_min: number | null;
  pin_max: number | null;
  boxed_on: string | null;
  label_photo_path: string | null;
  received_at: string;
  received_by: string;
};

export type Movement = {
  id: number;
  ball_id: string;
  type: MovementType;
  from_location_id: string | null;
  to_location_id: string | null;
  actor: string;
  at: string;
  reason: string | null;
  reference: string | null;
};
