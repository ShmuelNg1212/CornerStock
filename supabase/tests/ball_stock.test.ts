import { randomUUID } from "node:crypto";
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { Client } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

// Run with `npm run test:db`. The script starts a temporary Postgres server.
const url = process.env.TEST_DATABASE_URL;
if (!url) throw new Error("TEST_DATABASE_URL is not set. Run `npm run test:db`.");

const here = __dirname;
let admin: Client;
let owner: string;
let staff: string;
let secondStaff: string;
let inactive: string;
let mall: string;
let warehouse: string;
let addUser: (name: string, addedByOwner?: boolean) => Promise<string>;

async function connect(): Promise<Client> {
  const client = new Client({ connectionString: url });
  await client.connect();
  return client;
}

/** Runs `fn` as a signed-in user, or as a signed-out visitor when `user` is null. */
async function as<T>(user: string | null, fn: (c: Client) => Promise<T>, client = admin): Promise<T> {
  await client.query(`set role ${user ? "authenticated" : "anon"}`);
  await client.query("select set_config('request.jwt.claim.sub', $1, false)", [user ?? ""]);
  try {
    return await fn(client);
  } finally {
    await client.query("reset role");
  }
}

function label(overrides: Record<string, unknown> = {}) {
  return {
    serial: "23VSLE30B047",
    upc: "887970617601",
    brand: "Storm",
    model_name: "Solid Lock",
    nominal_weight_lb: 15,
    color: "Dark Red",
    fragrance: "Red Hot Cinnamon",
    coverstock: "NeX Solid Reactive",
    weight_block: "RAD-X Core",
    finish: "1500-grit Polished",
    rg: 2.48,
    diff: 0.054,
    mass_bias: 0.018,
    product_code: "BBMVSL15L",
    gross_weight_oz: 244,
    top_weight: 3.28,
    pin_min: 3,
    pin_max: 3.5,
    boxed_on: "2023-05-30",
    ...overrides,
  };
}

let serialCounter = 0;
const nextSerial = () => `TEST${String(++serialCounter).padStart(6, "0")}`;

async function receive(user: string | null, overrides: Record<string, unknown> = {}, location = mall, requestId = randomUUID()) {
  return as(user, async (c) => {
    const result = await c.query("select public.receive_ball($1, $2, $3) as id", [
      JSON.stringify(label({ serial: nextSerial(), ...overrides })),
      location,
      requestId,
    ]);
    return result.rows[0].id as string;
  });
}

const ballStatus = async (id: string) =>
  (await admin.query("select status, location_id from public.balls where id = $1", [id])).rows[0];
const movements = async (id: string) =>
  (await admin.query("select * from public.stock_movements where ball_id = $1 order by id", [id])).rows;

beforeAll(async () => {
  admin = await connect();
  await admin.query(readFileSync(path.join(here, "shim.sql"), "utf8"));
  const dir = path.join(here, "..", "migrations");
  for (const file of readdirSync(dir).sort()) {
    await admin.query(readFileSync(path.join(dir, file), "utf8"));
  }

  addUser = async (name: string, addedByOwner = true) =>
    (
      await admin.query(
        "insert into auth.users (email, raw_user_meta_data, raw_app_meta_data) values ($1, $2, $3) returning id",
        [`${name}@example.test`, JSON.stringify({ full_name: name }), JSON.stringify(addedByOwner ? { added_by_owner: true } : {})],
      )
    ).rows[0].id as string;
  owner = await addUser("Owner");
  staff = await addUser("Staff");
  secondStaff = await addUser("Second Staff");
  inactive = await addUser("Former Staff");
  await admin.query("update public.profiles set active = false where id = $1", [inactive]);

  mall = (await admin.query("select id from public.locations")).rows[0].id;
  warehouse = (await admin.query("insert into public.locations (name) values ('Warehouse') returning id")).rows[0].id;
});

afterAll(async () => {
  await admin.end();
});

describe("accounts", () => {
  it("makes the first account the owner and later accounts staff", async () => {
    const rows = (await admin.query("select id, role from public.profiles")).rows;
    const role = (id: string) => rows.find((r) => r.id === id).role;
    expect(role(owner)).toBe("owner");
    expect(role(staff)).toBe("staff");
    expect(role(secondStaff)).toBe("staff");
  });

  it("gives no access to an account that the owner did not add", async () => {
    const stranger = await addUser("Stranger", false);
    const profile = (await admin.query("select role, active from public.profiles where id = $1", [stranger])).rows[0];
    expect(profile).toEqual({ role: "staff", active: false });
    expect((await as(stranger, (c) => c.query("select * from public.balls"))).rows).toHaveLength(0);
    await expect(receive(stranger)).rejects.toThrow(/NOT_AUTHORIZED/);
  });

  it("refuses to remove the last active owner", async () => {
    await expect(admin.query("update public.profiles set active = false where id = $1", [owner])).rejects.toThrow(
      /LAST_OWNER/,
    );
    await expect(admin.query("update public.profiles set role = 'staff' where id = $1", [owner])).rejects.toThrow(
      /LAST_OWNER/,
    );
  });

  it("refuses a staff member who changes a role", async () => {
    const result = await as(staff, (c) =>
      c.query("update public.profiles set role = 'owner' where id = $1", [staff]),
    );
    expect(result.rowCount).toBe(0);
  });

  // Supabase Auth inserts the user, then writes the custom app metadata in a second statement.
  const authInsertThenMark = async (name: string) => {
    const id = (
      await admin.query("insert into auth.users (email, raw_user_meta_data) values ($1, $2) returning id", [
        `${name}@example.test`,
        JSON.stringify({ full_name: name }),
      ])
    ).rows[0].id as string;
    await admin.query(
      "update auth.users set raw_app_meta_data = raw_app_meta_data || '{\"added_by_owner\": true}' where id = $1",
      [id],
    );
    return id;
  };
  const isActive = async (id: string) =>
    (await admin.query("select active from public.profiles where id = $1", [id])).rows[0]?.active;

  it("gives access when the owner mark arrives after the insert", async () => {
    const added = await authInsertThenMark("Late Mark");
    expect(await isActive(added)).toBe(true);
  });

  it("keeps a deactivated account inactive when its app metadata changes later", async () => {
    const added = await authInsertThenMark("Deactivated Later");
    await admin.query("update public.profiles set active = false where id = $1", [added]);
    await admin.query(
      "update auth.users set raw_app_meta_data = raw_app_meta_data || '{\"provider\": \"email\"}' where id = $1",
      [added],
    );
    expect(await isActive(added)).toBe(false);
  });

  it("lets Supabase Auth delete an account with no stock history", async () => {
    const leaving = await addUser("Leaving");
    await admin.query("set role supabase_auth_admin");
    try {
      await admin.query("delete from auth.users where id = $1", [leaving]);
    } finally {
      await admin.query("reset role");
    }
    expect((await admin.query("select 1 from public.profiles where id = $1", [leaving])).rowCount).toBe(0);
  });

  it("refuses a Supabase Auth delete of the last active owner", async () => {
    await admin.query("set role supabase_auth_admin");
    try {
      await expect(admin.query("delete from auth.users where id = $1", [owner])).rejects.toThrow(/LAST_OWNER/);
    } finally {
      await admin.query("reset role");
    }
  });
});

describe("receive_ball", () => {
  it("refuses a serial number that is the product code of a model, and writes nothing", async () => {
    const before = Number((await admin.query("select count(*) from public.balls")).rows[0].count);
    const movesBefore = Number((await admin.query("select count(*) from public.stock_movements")).rows[0].count);
    const own = await receive(staff, { serial: "BBMVSL15L" }).catch((e) => e);
    expect(String(own.message)).toContain("SERIAL_IS_PRODUCT_CODE");
    // The product code of another model in the catalog, in lower case.
    await admin.query("insert into public.ball_models (upc, name, nominal_weight_lb, product_code) values ('887970778029', 'Other', 14, 'BBMGRN14L')");
    const other = await receive(staff, { serial: "bbmgrn14l".toUpperCase() }).catch((e) => e);
    expect(String(other.message)).toContain("SERIAL_IS_PRODUCT_CODE");
    expect(Number((await admin.query("select count(*) from public.balls")).rows[0].count)).toBe(before);
    expect(Number((await admin.query("select count(*) from public.stock_movements")).rows[0].count)).toBe(movesBefore);
  });

  it("refuses a correction that changes a serial number to a product code", async () => {
    const id = await receive(staff);
    const error = await as(owner, (c) =>
      c.query("select public.adjust_ball($1, $2, $3, $4)", [id, JSON.stringify({ serial: "BBMVSL15L" }), randomUUID(), "Typo"]),
    ).catch((e) => e);
    expect(String(error.message)).toContain("SERIAL_IS_PRODUCT_CODE");
  });

  it("creates the model, the ball, and one movement", async () => {
    const id = await receive(staff, { serial: "23VSLE30B047" });
    const ball = (await admin.query("select * from public.balls where id = $1", [id])).rows[0];
    expect(ball).toMatchObject({
      serial: "23VSLE30B047",
      status: "in_stock",
      location_id: mall,
      gross_weight_oz: 244,
      top_weight: "3.28",
      pin_min: "3.00",
      pin_max: "3.50",
      received_by: staff,
    });
    const model = (await admin.query("select * from public.ball_models where id = $1", [ball.model_id])).rows[0];
    expect(model).toMatchObject({ upc: "887970617601", name: "Solid Lock", nominal_weight_lb: 15, rg: "2.480" });
    const moves = await movements(id);
    expect(moves).toHaveLength(1);
    expect(moves[0]).toMatchObject({ type: "receive", to_location_id: mall, actor: staff });
  });

  it("refuses a serial number that is already recorded and names the ball", async () => {
    const first = (await admin.query("select id from public.balls where serial = '23VSLE30B047'")).rows[0].id;
    const error = await receive(secondStaff, { serial: "23VSLE30B047" }).catch((e) => e);
    expect(error.message).toMatch(/DUPLICATE_SERIAL/);
    expect(error.detail).toBe(first);
    expect((await admin.query("select count(*) from public.balls where serial = '23VSLE30B047'")).rows[0].count).toBe("1");
  });

  it("does not create a second ball for a repeated submission", async () => {
    const requestId = randomUUID();
    const serial = nextSerial();
    const first = await receive(staff, { serial }, mall, requestId);
    const second = await receive(staff, { serial }, mall, requestId);
    expect(second).toBe(first);
    expect(await movements(first)).toHaveLength(1);
  });

  it("does not create a second ball when the same submission runs two times at the same time", async () => {
    const other = await connect();
    try {
      const requestId = randomUUID();
      const serial = nextSerial();
      const args = [JSON.stringify(label({ serial })), mall, requestId];
      const run = (c: Client) =>
        as(staff, async () => (await c.query("select public.receive_ball($1, $2, $3) as id", args)).rows[0].id, c);
      const [a, b] = await Promise.all([run(admin), run(other)]);
      expect(a).toBe(b);
      expect((await admin.query("select count(*) from public.balls where serial = $1", [serial])).rows[0].count).toBe("1");
    } finally {
      await other.end();
    }
  });

  it("uses the same model for a second ball with the same UPC and keeps the catalog values", async () => {
    const id = await receive(staff, { model_name: "Misread Name" });
    const ball = (await admin.query("select model_id from public.balls where id = $1", [id])).rows[0];
    const models = (await admin.query("select id, name from public.ball_models where upc = '887970617601'")).rows;
    expect(models).toHaveLength(1);
    expect(models[0]).toMatchObject({ id: ball.model_id, name: "Solid Lock" });
  });

  it("puts the ball in the selected location", async () => {
    const id = await receive(staff, {}, warehouse);
    expect((await ballStatus(id)).location_id).toBe(warehouse);
  });

  it("refuses a bad UPC, a bad serial number, and an unknown location", async () => {
    await expect(receive(staff, { upc: "12345" })).rejects.toThrow();
    await expect(receive(staff, { serial: "bad serial!" })).rejects.toThrow();
    await expect(receive(staff, {}, randomUUID())).rejects.toThrow(/LOCATION_NOT_FOUND/);
  });

  it("refuses a signed-out visitor and an inactive account", async () => {
    await expect(receive(null)).rejects.toThrow(/permission denied|NOT_AUTHORIZED/);
    await expect(receive(inactive)).rejects.toThrow(/NOT_AUTHORIZED/);
  });
});

describe("sell_ball", () => {
  it("marks the ball as sold and writes a movement", async () => {
    const id = await receive(staff);
    await as(staff, (c) => c.query("select public.sell_ball($1, $2, $3)", [id, randomUUID(), "OR 1001"]));
    expect((await ballStatus(id)).status).toBe("sold");
    const moves = await movements(id);
    expect(moves.at(-1)).toMatchObject({ type: "sell", from_location_id: mall, actor: staff, reference: "OR 1001" });
  });

  it("refuses a second sale of the same ball", async () => {
    const id = await receive(staff);
    await as(staff, (c) => c.query("select public.sell_ball($1, $2)", [id, randomUUID()]));
    await expect(as(secondStaff, (c) => c.query("select public.sell_ball($1, $2)", [id, randomUUID()]))).rejects.toThrow(
      /WRONG_STATUS/,
    );
    expect(await movements(id)).toHaveLength(2);
  });

  it("does nothing for a repeated submission", async () => {
    const id = await receive(staff);
    const requestId = randomUUID();
    await as(staff, (c) => c.query("select public.sell_ball($1, $2)", [id, requestId]));
    await as(staff, (c) => c.query("select public.sell_ball($1, $2)", [id, requestId]));
    expect(await movements(id)).toHaveLength(2);
  });

  it("lets only one of two staff sell the same ball at the same time", async () => {
    const id = await receive(staff);
    const other = await connect();
    try {
      // The first sale is open when the second sale starts.
      await admin.query("begin");
      await as(staff, (c) => c.query("select public.sell_ball($1, $2)", [id, randomUUID()]));
      const second = as(secondStaff, (c) => c.query("select public.sell_ball($1, $2)", [id, randomUUID()]), other).then(
        () => "sold",
        (e: Error) => e.message,
      );
      await new Promise((resolve) => setTimeout(resolve, 200));
      await admin.query("commit");
      expect(await second).toMatch(/WRONG_STATUS/);
      expect((await movements(id)).filter((m) => m.type === "sell")).toHaveLength(1);
    } finally {
      await other.end();
    }
  });

  it("refuses an unknown ball", async () => {
    await expect(as(staff, (c) => c.query("select public.sell_ball($1, $2)", [randomUUID(), randomUUID()]))).rejects.toThrow(
      /BALL_NOT_FOUND/,
    );
  });
});

describe("transfer_ball", () => {
  it("moves the ball and writes a movement", async () => {
    const id = await receive(staff);
    await as(staff, (c) => c.query("select public.transfer_ball($1, $2, $3)", [id, warehouse, randomUUID()]));
    expect(await ballStatus(id)).toEqual({ status: "in_stock", location_id: warehouse });
    expect((await movements(id)).at(-1)).toMatchObject({
      type: "transfer",
      from_location_id: mall,
      to_location_id: warehouse,
    });
  });

  it("changes the count of each location", async () => {
    const count = async (location: string) =>
      (
        await as(staff, (c) =>
          c.query("select coalesce(sum(in_stock), 0)::int as n from public.stock_counts where location_id = $1", [location]),
        )
      ).rows[0].n as number;
    const [mallBefore, warehouseBefore] = [await count(mall), await count(warehouse)];
    const id = await receive(staff);
    expect(await count(mall)).toBe(mallBefore + 1);
    await as(staff, (c) => c.query("select public.transfer_ball($1, $2, $3)", [id, warehouse, randomUUID()]));
    expect(await count(mall)).toBe(mallBefore);
    expect(await count(warehouse)).toBe(warehouseBefore + 1);
  });

  it("refuses a move to the same location and a move of a sold ball", async () => {
    const id = await receive(staff);
    await expect(
      as(staff, (c) => c.query("select public.transfer_ball($1, $2, $3)", [id, mall, randomUUID()])),
    ).rejects.toThrow(/SAME_LOCATION/);
    await as(staff, (c) => c.query("select public.sell_ball($1, $2)", [id, randomUUID()]));
    await expect(
      as(staff, (c) => c.query("select public.transfer_ball($1, $2, $3)", [id, warehouse, randomUUID()])),
    ).rejects.toThrow(/WRONG_STATUS/);
  });
});

describe("owner actions", () => {
  it("lets the owner reverse a sale with a reason", async () => {
    const id = await receive(staff);
    await as(staff, (c) => c.query("select public.sell_ball($1, $2)", [id, randomUUID()]));
    await as(owner, (c) => c.query("select public.reverse_sale($1, $2, $3)", [id, randomUUID(), "Customer returned it"]));
    expect((await ballStatus(id)).status).toBe("in_stock");
    expect((await movements(id)).map((m) => m.type)).toEqual(["receive", "sell", "reverse_sale"]);
  });

  it("refuses staff who reverse a sale, remove a ball, or adjust a ball", async () => {
    const id = await receive(staff);
    await as(staff, (c) => c.query("select public.sell_ball($1, $2)", [id, randomUUID()]));
    const other = await receive(staff);
    for (const sql of [
      ["select public.reverse_sale($1, $2, 'x')", id],
      ["select public.remove_ball($1, $2, 'x')", other],
      [`select public.adjust_ball($1, '{"top_weight": 2}', $2, 'x')`, other],
    ]) {
      await expect(as(staff, (c) => c.query(sql[0], [sql[1], randomUUID()]))).rejects.toThrow(/NOT_AUTHORIZED/);
    }
    expect((await ballStatus(id)).status).toBe("sold");
    expect((await ballStatus(other)).status).toBe("in_stock");
  });

  it("requires a reason", async () => {
    const id = await receive(staff);
    await expect(as(owner, (c) => c.query("select public.remove_ball($1, $2, ' ')", [id, randomUUID()]))).rejects.toThrow(
      /REASON_REQUIRED/,
    );
  });

  it("removes a ball from stock with a reason", async () => {
    const id = await receive(staff);
    await as(owner, (c) => c.query("select public.remove_ball($1, $2, $3)", [id, randomUUID(), "Damaged in transit"]));
    expect((await ballStatus(id)).status).toBe("removed");
    expect((await movements(id)).at(-1)).toMatchObject({ type: "remove", reason: "Damaged in transit", actor: owner });
  });

  it("adjusts a ball and keeps the old values in the movement", async () => {
    const id = await receive(staff, { top_weight: 3.28 });
    await as(owner, (c) =>
      c.query("select public.adjust_ball($1, $2, $3, $4)", [
        id,
        JSON.stringify({ top_weight: 2.5, boxed_on: null }),
        randomUUID(),
        "Misread label",
      ]),
    );
    const ball = (await admin.query("select top_weight, boxed_on, gross_weight_oz from public.balls where id = $1", [id])).rows[0];
    expect(ball).toMatchObject({ top_weight: "2.50", boxed_on: null, gross_weight_oz: 244 });
    const move = (await movements(id)).at(-1);
    expect(move).toMatchObject({ type: "adjust", reason: "Misread label" });
    expect(JSON.parse(move.reference)).toMatchObject({ top_weight: 3.28, boxed_on: "2023-05-30" });
  });
});

describe("direct table access", () => {
  it("shows no stock to a signed-out visitor or an inactive account", async () => {
    for (const table of ["balls", "ball_models", "locations", "stock_movements", "profiles", "stock_counts"]) {
      await expect(as(null, (c) => c.query(`select * from public.${table}`))).rejects.toThrow(/permission denied/);
      expect((await as(inactive, (c) => c.query(`select * from public.${table}`))).rows).toHaveLength(0);
    }
  });

  it("shows stock to staff", async () => {
    expect((await as(staff, (c) => c.query("select * from public.balls"))).rows.length).toBeGreaterThan(0);
    expect((await as(staff, (c) => c.query("select * from public.stock_counts"))).rows.length).toBeGreaterThan(0);
  });

  it("refuses direct changes to balls and movements, also for the owner", async () => {
    const id = await receive(staff);
    for (const user of [staff, owner]) {
      await expect(as(user, (c) => c.query("update public.balls set status = 'sold' where id = $1", [id]))).rejects.toThrow(
        /permission denied/,
      );
      await expect(as(user, (c) => c.query("delete from public.balls where id = $1", [id]))).rejects.toThrow(
        /permission denied/,
      );
      await expect(as(user, (c) => c.query("delete from public.stock_movements"))).rejects.toThrow(/permission denied/);
    }
  });

  it("keeps movements permanent, also for a database administrator", async () => {
    await expect(admin.query("update public.stock_movements set reason = 'x'")).rejects.toThrow(/MOVEMENTS_ARE_PERMANENT/);
    await expect(admin.query("delete from public.stock_movements")).rejects.toThrow(/MOVEMENTS_ARE_PERMANENT/);
  });

  it("lets only the owner add a location or set a price", async () => {
    await expect(as(staff, (c) => c.query("insert into public.locations (name) values ('Staff Store')"))).rejects.toThrow(
      /row-level security/,
    );
    await as(owner, (c) => c.query("insert into public.locations (name) values ('Second Store')"));
    expect((await as(staff, (c) => c.query("update public.ball_models set selling_price = 1"))).rowCount).toBe(0);
    expect(
      (await as(owner, (c) => c.query("update public.ball_models set selling_price = 12500 where upc = '887970617601'")))
        .rowCount,
    ).toBe(1);
  });

  it("lets only the owner edit the model details, and keeps the UPC and weight fixed", async () => {
    const edit = "update public.ball_models set name = 'Phaze II Pearl', rg = 2.5 where upc = '887970617601'";
    expect((await as(staff, (c) => c.query(edit))).rowCount).toBe(0);
    expect((await as(owner, (c) => c.query(edit))).rowCount).toBe(1);
    const row = (await admin.query("select name, rg from public.ball_models where upc = '887970617601'")).rows[0];
    expect(row).toEqual({ name: "Phaze II Pearl", rg: "2.500" });
    await expect(
      as(owner, (c) => c.query("update public.ball_models set upc = '887970617618' where upc = '887970617601'")),
    ).rejects.toThrow(/permission denied/);
    await expect(
      as(owner, (c) => c.query("update public.ball_models set nominal_weight_lb = 14 where upc = '887970617601'")),
    ).rejects.toThrow(/permission denied/);
  });
});

describe("catalog file import", () => {
  const modelValues = (upc = "012345678905") => ({
    upc, name: "Import Model", nominal_weight_lb: 15, brand: "Storm", color: null,
    fragrance: null, coverstock: null, weight_block: null, finish: null,
    rg: null, diff: null, mass_bias: null, product_code: null, selling_price: 12500,
  });
  const currentModel = async (upc: string) =>
    (await admin.query("select to_jsonb(m) as row from public.ball_models m where upc=$1", [upc])).rows[0]?.row ?? null;
  const currentBall = async (serial: string) =>
    (await admin.query("select to_jsonb(b) as row from public.balls b where serial=$1", [serial])).rows[0]?.row ?? null;
  const importBatch = (payload: object, requestId = randomUUID(), user: string | null = owner, client = admin) =>
    as(user, async (c) => (await c.query("select public.commit_catalog_import($1,$2) as result", [requestId, JSON.stringify(payload)])).rows[0].result, client);
  const batch = (upc = "012345678905") => ({kind: "catalog", reason: "", models: [{upc, before: null, after: modelValues(upc)}], balls: []});
  const stockRow = (serial: string, upc: string, before: object | null = null, location = mall) => ({
    serial, before, label: label({serial, upc, model_name: "Import Model", gross_weight_oz: null, top_weight: null, pin_min: null, pin_max: null, boxed_on: null}), location_id: location,
  });

  it("creates catalog entries without stock and records an owner-only audit", async () => {
    expect(await importBatch(batch())).toMatchObject({models_added: 1, balls_added: 0, models_updated: 0});
    const model = await currentModel("012345678905");
    expect(model).toMatchObject({name: "Import Model", selling_price: 12500});
    expect((await admin.query("select count(*) from public.balls where model_id=$1", [model.id])).rows[0].count).toBe("0");
    expect((await as(owner, c => c.query("select * from public.catalog_import_batches"))).rows.length).toBeGreaterThan(0);
    expect((await as(staff, c => c.query("select * from public.catalog_import_batches"))).rows).toHaveLength(0);
  });

  it("rejects staff, inactive accounts, and signed-out callers", async () => {
    for (const user of [staff, inactive, null]) {
      await expect(importBatch(batch("036000291452"), randomUUID(), user)).rejects.toThrow(/NOT_AUTHORIZED|permission denied/);
    }
  });

  it("creates a missing catalog model and receives a ball in one batch", async () => {
    const p = {...batch("036000291452"), kind: "stock", balls: [stockRow("IMPORT0001", "036000291452")]};
    expect(await importBatch(p)).toMatchObject({models_added: 1, balls_added: 1});
    const b = await currentBall("IMPORT0001");
    expect(b).toMatchObject({status: "in_stock", location_id: mall, received_by: owner});
    expect((await movements(b.id)).map(m => m.type)).toEqual(["receive"]);
    expect((await currentModel("036000291452")).selling_price).toBe(12500);
  });

  it("replays the same request without a second write and rejects a different payload", async () => {
    const request = randomUUID();
    const p = batch("042100005264");
    const result = await importBatch(p, request);
    expect(await importBatch(p, request)).toEqual(result);
    await expect(importBatch({...p, reason: "different"}, request)).rejects.toThrow(/REQUEST_MISMATCH/);
  });

  it("updates catalog values with a snapshot and refuses stale reviews", async () => {
    const before = await currentModel("012345678905");
    const after = {...modelValues(), name: "Changed Model", color: "Blue"};
    const p = {kind: "catalog", reason: "", models: [{upc: before.upc, before, after}], balls: []};
    expect(await importBatch(p)).toMatchObject({models_updated: 1});
    expect(await currentModel(before.upc)).toMatchObject({name: "Changed Model", color: "Blue"});
    await expect(importBatch(p)).rejects.toThrow(/STALE_REVIEW/);
  });

  it("corrects and transfers existing stock with a reason and keeps its identity", async () => {
    const before = await currentBall("IMPORT0001");
    const model = await currentModel("036000291452");
    const row = stockRow(before.serial, model.upc, before, warehouse);
    row.label.top_weight = 2.5;
    const p = {kind: "stock", reason: "Correct import", models: [{upc: model.upc, before: model, after: modelValues(model.upc)}], balls: [row]};
    expect(await importBatch(p)).toMatchObject({balls_updated: 1});
    const b = await currentBall(before.serial);
    expect(b).toMatchObject({id: before.id, model_id: before.model_id, status: before.status, location_id: warehouse, top_weight: 2.5});
    const history = await movements(b.id);
    expect(history.map(m => m.type)).toEqual(["receive", "adjust", "transfer"]);
    expect(history.slice(1).every(m => m.reason === "Correct import")).toBe(true);
  });

  it("requires a reason for existing stock changes but not for unchanged rows", async () => {
    const before = await currentBall("IMPORT0001");
    const model = await currentModel("036000291452");
    const row = stockRow(before.serial, model.upc, before, warehouse);
    row.label.top_weight = 2.5;
    const p = {kind: "stock", reason: "", models: [{upc: model.upc, before: model, after: modelValues(model.upc)}], balls: [row]};
    expect(await importBatch(p)).toMatchObject({balls_updated: 0});
    row.label.top_weight = 3;
    await expect(importBatch(p)).rejects.toThrow(/REASON_REQUIRED/);
  });

  it("rolls back earlier catalog changes when a later stock row is invalid", async () => {
    const p = {...batch("123456789012"), kind: "stock", balls: [stockRow("IMPORT0002", "123456789012", null, randomUUID())]};
    await expect(importBatch(p)).rejects.toThrow(/LOCATION_NOT_FOUND/);
    expect(await currentModel("123456789012")).toBeNull();
    expect(await currentBall("IMPORT0002")).toBeNull();
  });

  it("rejects invalid direct RPC values, duplicate rows, and identity changes", async () => {
    await expect(importBatch(batch("012345678906"))).rejects.toThrow(/INVALID_UPC/);
    const p = batch("123456789012");
    await expect(importBatch({...p, models: [p.models[0], p.models[0]]})).rejects.toThrow(/DUPLICATE_UPC/);
    const before = await currentModel("012345678905");
    await expect(importBatch({kind:"catalog", models:[{upc:before.upc,before,after:{...modelValues(),nominal_weight_lb:14}}],balls:[]})).rejects.toThrow(/IMMUTABLE_IDENTITY/);
    const b = await currentBall("IMPORT0001");
    const model = await currentModel("012345678905");
    await expect(importBatch({kind:"stock",reason:"x",models:[{upc:model.upc,before:model,after:{...modelValues(),name:model.name,color:model.color}}],balls:[stockRow(b.serial,model.upc,b,warehouse)]})).rejects.toThrow(/IMMUTABLE_IDENTITY/);
  });

  it("rejects stock field ranges, duplicate serials, injected status, and stale stock snapshots", async () => {
    const before = await currentBall("IMPORT0001");
    const model = await currentModel("036000291452");
    const row = stockRow(before.serial, model.upc, before, warehouse);
    row.label.top_weight = 2.5;
    const p = {kind:"stock",reason:"Correction",models:[{upc:model.upc,before:model,after:modelValues(model.upc)}],balls:[row]};
    await expect(importBatch({...p,balls:[row,row]})).rejects.toThrow(/DUPLICATE_SERIAL/);
    await expect(importBatch({...p,balls:[{...row,label:{...row.label,status:"sold"}}]})).rejects.toThrow(/INVALID_IMPORT/);
    await expect(importBatch({...p,balls:[{...row,label:{...row.label,top_weight:11}}]})).rejects.toThrow(/INVALID_IMPORT/);
    await expect(importBatch({...p,balls:[{...row,label:{...row.label,pin_min:4,pin_max:3}}]})).rejects.toThrow(/INVALID_IMPORT/);
    await expect(importBatch({...p,balls:[{...row,label:{...row.label,boxed_on:"2026-02-30"}}]})).rejects.toThrow();
    await as(owner,c => c.query("select public.adjust_ball($1,$2,$3,'Other correction')",[before.id,JSON.stringify({top_weight:3}),randomUUID()]));
    await expect(importBatch(p)).rejects.toThrow(/STALE_REVIEW/);
  });

  it("rejects changed catalog weights and out-of-range or rounded numeric values", async () => {
    const before = await currentModel("012345678905");
    const values = {...modelValues(),name:before.name,color:before.color};
    for (const change of [{rg:1.9},{rg:2.1234},{diff:0.2},{selling_price:-1},{selling_price:12.345},{nominal_weight_lb:15.5}]) {
      await expect(importBatch({kind:"catalog",models:[{upc:before.upc,before,after:{...values,...change}}],balls:[]})).rejects.toThrow(/INVALID_IMPORT/);
    }
  });

  it("does not move a sold ball and rolls back catalog updates when a transfer fails", async () => {
    const before = await currentBall("IMPORT0001");
    await as(owner,c => c.query("select public.sell_ball($1,$2)",[before.id,randomUUID()]));
    const sold = await currentBall(before.serial);
    const model = await currentModel("036000291452");
    const row = stockRow(before.serial,model.upc,sold,mall);
    row.label.top_weight = 3;
    await expect(importBatch({kind:"stock",reason:"Correction",models:[{upc:model.upc,before:model,after:{...modelValues(model.upc),name:"Must roll back"}}],balls:[row]})).rejects.toThrow(/WRONG_STATUS/);
    expect((await currentModel(model.upc)).name).toBe(model.name);
    expect((await currentBall(before.serial)).status).toBe("sold");
  });

  it("serializes concurrent retries and binds the result to its owner", async () => {
    const other = await connect();
    try {
      const p = batch("400638133390");
      const request = randomUUID();
      const results = await Promise.all([importBatch(p,request),importBatch(p,request,owner,other)]);
      expect(results[0]).toEqual(results[1]);
      const secondOwner = await addUser("Import Second Owner");
      await admin.query("update public.profiles set role='owner' where id=$1",[secondOwner]);
      await expect(importBatch(p,request,secondOwner)).rejects.toThrow(/REQUEST_MISMATCH/);
    } finally { await other.end(); }
  });

  it("allows one of two concurrent catalog creates and refuses the stale one", async () => {
    const other = await connect();
    try {
      const p = batch("725272730706");
      const outcomes = await Promise.allSettled([importBatch(p), importBatch(p,randomUUID(),owner,other)]);
      expect(outcomes.filter(o => o.status === "fulfilled")).toHaveLength(1);
      expect(outcomes.filter(o => o.status === "rejected")).toHaveLength(1);
      expect((await admin.query("select count(*) from public.ball_models where upc=$1", [p.models[0].upc])).rows[0].count).toBe("1");
    } finally { await other.end(); }
  });
});

describe("activity feed", () => {
  type Row = { src: number; id: string; at: Date; at_text: string; type: string; actor_name: string | null; serial: string | null; model_name: string; from_location: string | null; to_location: string | null; reason: string | null; reference: string | null; old_values: Record<string, unknown> | null; new_values: Record<string, unknown> | null };
  const feed = (user: string | null, args: { before?: Row; types?: string[]; limit?: number } = {}) =>
    as(user, async (c) =>
      (
        await c.query("select *, at::text as at_text from public.activity_feed($1, $2, $3, $4, $5)", [
          // The driver cuts a timestamp to milliseconds. The cursor needs the exact value.
          args.before?.at_text ?? null,
          args.before?.src ?? null,
          args.before?.id ?? null,
          args.types ?? null,
          args.limit ?? 50,
        ])
      ).rows as Row[],
    );

  it("shows each stock change of a ball, newest first, with names", async () => {
    const id = await receive(staff, { upc: "725272730728", model_name: "Activity Ball" });
    await as(staff, (c) => c.query("select public.transfer_ball($1, $2, $3)", [id, warehouse, randomUUID()]));
    await as(staff, (c) => c.query("select public.sell_ball($1, $2, $3)", [id, randomUUID(), "OR-1102"]));
    await as(owner, (c) => c.query("select public.reverse_sale($1, $2, $3)", [id, randomUUID(), "Wrong ball"]));
    await as(owner, (c) => c.query("select public.remove_ball($1, $2, $3)", [id, randomUUID(), "Damaged"]));
    const serial = (await admin.query("select serial from public.balls where id = $1", [id])).rows[0].serial;
    const rows = (await feed(staff)).filter((r) => r.serial === serial);
    expect(rows.map((r) => r.type)).toEqual(["remove", "reverse_sale", "sell", "transfer", "receive"]);
    expect(rows[2]).toMatchObject({ actor_name: "Staff", model_name: "Activity Ball", from_location: "Warehouse", reference: "OR-1102" });
    expect(rows[3]).toMatchObject({ from_location: "Sta. Lucia East Mall", to_location: "Warehouse" });
    expect(rows[1]).toMatchObject({ actor_name: "Owner", reason: "Wrong ball" });
  });

  it("gives the old and the new values of each ball correction", async () => {
    const id = await receive(staff, { top_weight: 3.28 });
    await as(owner, (c) => c.query("select public.adjust_ball($1, $2, $3, $4)", [id, { top_weight: 3 }, randomUUID(), "First fix"]));
    await as(owner, (c) => c.query("select public.adjust_ball($1, $2, $3, $4)", [id, { top_weight: 2.5 }, randomUUID(), "Second fix"]));
    const serial = (await admin.query("select serial from public.balls where id = $1", [id])).rows[0].serial;
    const [second, first] = (await feed(staff, { types: ["adjust"] })).filter((r) => r.serial === serial);
    expect([Number(first.old_values!.top_weight), Number(first.new_values!.top_weight)]).toEqual([3.28, 3]);
    expect([Number(second.old_values!.top_weight), Number(second.new_values!.top_weight)]).toEqual([3, 2.5]);
    expect(second.reference).toBeNull();
  });

  it("returns only the selected types", async () => {
    const rows = await feed(staff, { types: ["sell", "remove"] });
    expect(rows.length).toBeGreaterThan(0);
    expect(new Set(rows.map((r) => r.type))).toEqual(new Set(["sell", "remove"]));
  });

  it("pages through all rows with no gap and no repeat", async () => {
    const seen: string[] = [];
    let before: Row | undefined;
    for (;;) {
      const page = await feed(staff, { before, limit: 7 });
      seen.push(...page.map((r) => `${r.src}:${r.id}`));
      if (page.length < 7) break;
      before = page[page.length - 1];
    }
    const total = (
      await admin.query("select (select count(*) from public.stock_movements) + (select count(*) from public.catalog_changes) as n")
    ).rows[0].n;
    expect(new Set(seen).size).toBe(seen.length);
    expect(seen.length).toBe(Number(total));
  });

  it("shows nothing to a signed-out visitor or an inactive account", async () => {
    await expect(feed(null)).rejects.toThrow(/permission denied/);
    expect(await feed(inactive)).toHaveLength(0);
  });

  it("records a catalog edit with only the changed values, and shows it", async () => {
    await receive(staff, { upc: "725272730711", model_name: "Edit Me" });
    await as(owner, (c) =>
      c.query("update public.ball_models set name = 'Edited', selling_price = 9800, color = color where upc = '725272730711'"),
    );
    const [row] = await feed(staff, { types: ["model_edit"], limit: 1 });
    expect(row).toMatchObject({ actor_name: "Owner", model_name: "Edited", serial: null });
    expect(row.old_values).toEqual({ name: "Edit Me", selling_price: null });
    expect(row.new_values).toEqual({ name: "Edited", selling_price: 9800 });
  });

  it("records nothing for an edit that changes no value, and keeps catalog changes permanent", async () => {
    const count = async () => Number((await admin.query("select count(*) as n from public.catalog_changes")).rows[0].n);
    const before = await count();
    await as(owner, (c) => c.query("update public.ball_models set name = name where upc = '725272730711'"));
    expect(await count()).toBe(before);
    await expect(admin.query("delete from public.catalog_changes")).rejects.toThrow(/MOVEMENTS_ARE_PERMANENT/);
    await expect(as(owner, (c) => c.query("insert into public.catalog_changes (model_id, old_values, new_values) select id, '{}', '{}' from public.ball_models limit 1"))).rejects.toThrow(/permission denied/);
  });
});

describe("low stock", () => {
  /** A UPC-A with a correct check digit, from 11 digits. */
  const upcOf = (eleven: string) => {
    let sum = 0;
    for (let i = 0; i < 11; i++) sum += Number(eleven[i]) * (i % 2 === 0 ? 3 : 1);
    return eleven + ((10 - (sum % 10)) % 10);
  };
  const lowRows = async (user: string | null, modelId: string) =>
    as(user, async (c) => (await c.query("select location_id, in_stock, min_in_stock from public.low_stock where model_id = $1", [modelId])).rows);
  const modelOf = async (upc: string) => (await admin.query("select id from public.ball_models where upc = $1", [upc])).rows[0].id as string;
  const setMin = (user: string, upc: string, min: number | null) =>
    as(user, (c) => c.query("update public.ball_models set min_in_stock = $1 where upc = $2", [min, upc]));

  it("lists a location with fewer balls than the minimum, and not a location with enough", async () => {
    const upc = upcOf("10000000001");
    await receive(staff, { upc, model_name: "Low Here" }, mall);
    for (let i = 0; i < 3; i++) await receive(staff, { upc, model_name: "Low Here" }, warehouse);
    await setMin(owner, upc, 2);
    const rows = await lowRows(staff, await modelOf(upc));
    expect(rows.find((r) => r.location_id === mall)).toEqual({ location_id: mall, in_stock: 1, min_in_stock: 2 });
    expect(rows.find((r) => r.location_id === warehouse)).toBeUndefined();
  });

  it("lists an active location with no ball as 0 in stock, and leaves out an inactive location", async () => {
    const upc = upcOf("10000000002");
    await receive(staff, { upc, model_name: "Out There" }, mall);
    await setMin(owner, upc, 1);
    const empty = (await admin.query("insert into public.locations (name) values ('Empty Shelf') returning id")).rows[0].id;
    const closed = (await admin.query("insert into public.locations (name, active) values ('Closed Shelf', false) returning id")).rows[0].id;
    const rows = await lowRows(staff, await modelOf(upc));
    expect(rows.find((r) => r.location_id === empty)).toEqual({ location_id: empty, in_stock: 0, min_in_stock: 1 });
    expect(rows.find((r) => r.location_id === closed)).toBeUndefined();
    expect(rows.find((r) => r.location_id === mall)).toBeUndefined();
  });

  it("counts only balls in stock: a sold ball does not count", async () => {
    const upc = upcOf("10000000003");
    const id = await receive(staff, { upc, model_name: "Sold Down" }, mall);
    await receive(staff, { upc, model_name: "Sold Down" }, mall);
    await setMin(owner, upc, 2);
    expect((await lowRows(staff, await modelOf(upc))).find((r) => r.location_id === mall)).toBeUndefined();
    await as(staff, (c) => c.query("select public.sell_ball($1, $2)", [id, randomUUID()]));
    expect((await lowRows(staff, await modelOf(upc))).find((r) => r.location_id === mall)).toMatchObject({ in_stock: 1 });
  });

  it("gives no row for a model with no minimum, or a minimum of 0", async () => {
    const upc = upcOf("10000000004");
    await receive(staff, { upc, model_name: "No Minimum" }, mall);
    expect(await lowRows(staff, await modelOf(upc))).toEqual([]);
    await setMin(owner, upc, 0);
    expect(await lowRows(staff, await modelOf(upc))).toEqual([]);
  });

  it("lets only the owner set the minimum, from 0 to 99", async () => {
    const upc = upcOf("10000000005");
    await receive(staff, { upc, model_name: "Owner Sets" }, mall);
    expect((await setMin(staff, upc, 3)).rowCount).toBe(0);
    expect((await setMin(owner, upc, 3)).rowCount).toBe(1);
    await expect(setMin(owner, upc, 100)).rejects.toThrow(/check constraint/);
    await expect(setMin(owner, upc, -1)).rejects.toThrow(/check constraint/);
  });

  it("records a change of the minimum in the catalog edit log", async () => {
    const upc = upcOf("10000000006");
    await receive(staff, { upc, model_name: "Logged Min" }, mall);
    await setMin(owner, upc, 4);
    const row = (
      await admin.query("select old_values, new_values from public.catalog_changes where model_id = $1 order by id desc limit 1", [await modelOf(upc)])
    ).rows[0];
    expect(row).toEqual({ old_values: { min_in_stock: null }, new_values: { min_in_stock: 4 } });
  });

  const importModel = async (upc: string, after: Record<string, unknown>) => {
    const before = (await admin.query("select to_jsonb(m) as row from public.ball_models m where upc = $1", [upc])).rows[0]?.row ?? null;
    const payload = { kind: "catalog", reason: "", models: [{ upc, before, after }], balls: [] };
    return as(owner, async (c) => (await c.query("select public.commit_catalog_import($1, $2) as result", [randomUUID(), JSON.stringify(payload)])).rows[0].result);
  };
  const importValues = (upc: string, extra: Record<string, unknown> = {}) => ({
    upc, name: "Import Min", nominal_weight_lb: 15, brand: "Storm", color: null, fragrance: null, coverstock: null,
    weight_block: null, finish: null, rg: null, diff: null, mass_bias: null, product_code: null, selling_price: null, ...extra,
  });

  it("lets a catalog import set the minimum, and counts a row with the same minimum as unchanged", async () => {
    const upc = upcOf("10000000007");
    expect(await importModel(upc, importValues(upc, { min_in_stock: 2 }))).toMatchObject({ models_added: 1 });
    expect((await admin.query("select min_in_stock from public.ball_models where upc = $1", [upc])).rows[0].min_in_stock).toBe(2);
    expect(await importModel(upc, importValues(upc, { min_in_stock: 2 }))).toMatchObject({ models_updated: 0, unchanged: 1 });
    expect(await importModel(upc, importValues(upc, { min_in_stock: 5 }))).toMatchObject({ models_updated: 1 });
    expect((await admin.query("select min_in_stock from public.ball_models where upc = $1", [upc])).rows[0].min_in_stock).toBe(5);
  });

  it("refuses an imported minimum outside 0 to 99, or with decimals", async () => {
    const upc = upcOf("10000000008");
    await expect(importModel(upc, importValues(upc, { min_in_stock: 100 }))).rejects.toThrow(/INVALID_IMPORT|check constraint/);
    await expect(importModel(upc, importValues(upc, { min_in_stock: 1.5 }))).rejects.toThrow(/INVALID_IMPORT/);
  });

  it("gives signed-in users only read access to the view", async () => {
    const privileges = (
      await admin.query(
        "select has_table_privilege('authenticated', 'public.low_stock', 'INSERT') as ins, has_table_privilege('authenticated', 'public.low_stock', 'UPDATE') as upd, has_table_privilege('authenticated', 'public.low_stock', 'SELECT') as sel",
      )
    ).rows[0];
    expect(privileges).toEqual({ ins: false, upd: false, sel: true });
  });

  it("shows nothing to a signed-out visitor or an inactive account", async () => {
    const id = await modelOf(upcOf("10000000001"));
    await expect(lowRows(null, id)).rejects.toThrow(/permission denied/);
    expect(await lowRows(inactive, id)).toEqual([]);
  });
});

describe("stock count", () => {
  type ScanResult = { serial: string; status: string; duplicate: boolean; ball_id: string | null; location: string | null; scanned: number; expected: number };
  type Line = { serial: string; ball_id: string | null; outcome: string; kind: string | null; other_location: string | null; corrected: boolean };
  type Result = { id: string; status: string; location: string; found: number; missing: number; unexpected: number; lines: Line[] };

  let shelf = 0;
  const newLocation = async () =>
    (await admin.query("insert into public.locations (name) values ($1) returning id", [`Count Shelf ${++shelf}`])).rows[0].id as string;
  const serialOf = async (id: string) => (await admin.query("select serial from public.balls where id = $1", [id])).rows[0].serial as string;
  const start = (user: string | null, location: string) =>
    as(user, async (c) => (await c.query("select public.start_count($1) as r", [location])).rows[0].r as { id: string; scanned: number; expected: number });
  const scan = (user: string | null, count: string, serial: string) =>
    as(user, async (c) => (await c.query("select public.add_count_scan($1, $2) as r", [count, serial])).rows[0].r as ScanResult);
  const finish = (user: string | null, count: string) =>
    as(user, async (c) => (await c.query("select public.finish_count($1) as r", [count])).rows[0].r as Result);
  const result = (user: string | null, count: string) =>
    as(user, async (c) => (await c.query("select public.count_result($1) as r", [count])).rows[0].r as Result);
  const correct = (user: string | null, count: string, serial: string, reason: string | null = null, requestId = randomUUID()) =>
    as(user, (c) => c.query("select public.correct_count_line($1, $2, $3, $4)", [count, serial, requestId, reason]));
  const line = (r: Result, serial: string) => r.lines.find((l) => l.serial === serial);

  it("gives one open count for a location, also for two starts", async () => {
    const loc = await newLocation();
    const first = await start(staff, loc);
    const second = await start(secondStaff, loc);
    expect(second.id).toBe(first.id);
    expect((await admin.query("select count(*)::int as n from public.counts where location_id = $1", [loc])).rows[0].n).toBe(1);
  });

  it("gives one open count when two starts run at the same time", async () => {
    const loc = await newLocation();
    const other = await connect();
    try {
      const [a, b] = await Promise.all([
        as(staff, async (c) => (await c.query("select public.start_count($1) as r", [loc])).rows[0].r, admin),
        as(secondStaff, async (c) => (await c.query("select public.start_count($1) as r", [loc])).rows[0].r, other),
      ]);
      expect(a.id).toBe(b.id);
    } finally {
      await other.end();
    }
  });

  it("records a serial one time, also for a second scan", async () => {
    const loc = await newLocation();
    const id = await receive(staff, {}, loc);
    const serial = await serialOf(id);
    const { id: count } = await start(staff, loc);
    const one = await scan(staff, count, serial);
    const two = await scan(secondStaff, count, ` ${serial.toLowerCase()} `);
    expect(one).toMatchObject({ status: "found", duplicate: false, ball_id: id, scanned: 1, expected: 1 });
    expect(two).toMatchObject({ status: "found", duplicate: true, scanned: 1 });
    expect((await admin.query("select count(*)::int as n from public.count_scans where count_id = $1", [count])).rows[0].n).toBe(1);
  });

  it("gives the status of each scan", async () => {
    const loc = await newLocation();
    const here = await receive(staff, {}, loc);
    const elsewhere = await receive(staff, {}, warehouse);
    const sold = await receive(staff, {}, loc);
    const removed = await receive(staff, {}, loc);
    await as(staff, (c) => c.query("select public.sell_ball($1, $2)", [sold, randomUUID()]));
    await as(owner, (c) => c.query("select public.remove_ball($1, $2, $3)", [removed, randomUUID(), "Damaged"]));
    const { id: count } = await start(staff, loc);
    expect(await scan(staff, count, await serialOf(here))).toMatchObject({ status: "found" });
    expect(await scan(staff, count, await serialOf(elsewhere))).toMatchObject({ status: "other_location", location: "Warehouse", ball_id: elsewhere });
    expect(await scan(staff, count, await serialOf(sold))).toMatchObject({ status: "sold" });
    expect(await scan(staff, count, await serialOf(removed))).toMatchObject({ status: "removed" });
    expect(await scan(staff, count, "26NEWB00X001")).toMatchObject({ status: "not_recorded", ball_id: null });
    await expect(scan(staff, count, "no")).rejects.toThrow(/INVALID_SERIAL/);
  });

  it("lists a missing ball and an unexpected ball at the finish, and keeps the totals", async () => {
    const loc = await newLocation();
    const found = await receive(staff, {}, loc);
    const missing = await receive(staff, {}, loc);
    const unexpected = await receive(staff, {}, warehouse);
    const { id: count } = await start(staff, loc);
    await scan(staff, count, await serialOf(found));
    await scan(staff, count, await serialOf(unexpected));
    const r = await finish(secondStaff, count);
    expect(r).toMatchObject({ status: "finished", found: 1, missing: 1, unexpected: 1 });
    expect(line(r, await serialOf(found))).toMatchObject({ outcome: "found", ball_id: found });
    expect(line(r, await serialOf(missing))).toMatchObject({ outcome: "missing", ball_id: missing, corrected: false });
    expect(line(r, await serialOf(unexpected))).toMatchObject({ outcome: "unexpected", kind: "other_location", other_location: "Warehouse" });
  });

  it("does not list a ball sold during the count as missing", async () => {
    const loc = await newLocation();
    const id = await receive(staff, {}, loc);
    const { id: count } = await start(staff, loc);
    await as(staff, (c) => c.query("select public.sell_ball($1, $2)", [id, randomUUID()]));
    const r = await finish(staff, count);
    expect(r).toMatchObject({ found: 0, missing: 0, unexpected: 0, lines: [] });
  });

  it("refuses scans after the finish, and a second finish; a new start gives a new count", async () => {
    const loc = await newLocation();
    const { id: count } = await start(staff, loc);
    await finish(staff, count);
    await expect(scan(staff, count, "26NEWB00X002")).rejects.toThrow(/COUNT_CLOSED/);
    await expect(finish(staff, count)).rejects.toThrow(/COUNT_CLOSED/);
    expect((await start(staff, loc)).id).not.toBe(count);
  });

  it("cancels an open count and refuses its scans", async () => {
    const loc = await newLocation();
    const { id: count } = await start(staff, loc);
    await as(secondStaff, (c) => c.query("select public.cancel_count($1)", [count]));
    await expect(scan(staff, count, "26NEWB00X003")).rejects.toThrow(/COUNT_CLOSED/);
    expect((await admin.query("select status from public.counts where id = $1", [count])).rows[0].status).toBe("cancelled");
  });

  it("refuses a signed-out visitor and an inactive account", async () => {
    const loc = await newLocation();
    await expect(start(null, loc)).rejects.toThrow(/permission denied/);
    await expect(start(inactive, loc)).rejects.toThrow(/NOT_AUTHORIZED/);
    const { id: count } = await start(staff, loc);
    await expect(scan(inactive, count, "26NEWB00X004")).rejects.toThrow(/NOT_AUTHORIZED/);
    await expect(finish(inactive, count)).rejects.toThrow(/NOT_AUTHORIZED/);
    await expect(result(inactive, count)).rejects.toThrow(/NOT_AUTHORIZED/);
    await expect(as(inactive, (c) => c.query("select public.count_history()"))).rejects.toThrow(/NOT_AUTHORIZED/);
  });

  it("keeps the helper functions internal", async () => {
    const rows = (
      await admin.query(
        "select has_function_privilege('authenticated', 'public.count_totals(uuid)', 'EXECUTE') as totals, has_function_privilege('authenticated', 'public.count_label(uuid)', 'EXECUTE') as label, has_function_privilege('authenticated', 'public.transfer_ball_with_reason(uuid, uuid, uuid, text)', 'EXECUTE') as move",
      )
    ).rows[0];
    expect(rows).toEqual({ totals: false, label: false, move: false });
  });

  it("gives no direct table access, also to the owner", async () => {
    for (const table of ["counts", "count_scans", "count_lines"]) {
      await expect(as(owner, (c) => c.query(`select * from public.${table}`))).rejects.toThrow(/permission denied/);
      await expect(as(staff, (c) => c.query(`delete from public.${table}`))).rejects.toThrow(/permission denied/);
    }
  });

  it("keeps the result of a finished count, and marks a line as corrected after a later change", async () => {
    const loc = await newLocation();
    const missing = await receive(staff, {}, loc);
    const { id: count } = await start(staff, loc);
    await finish(staff, count);
    await as(staff, (c) => c.query("select public.transfer_ball($1, $2, $3)", [missing, warehouse, randomUUID()]));
    const r = await result(staff, count);
    expect(r.missing).toBe(1);
    expect(line(r, await serialOf(missing))).toMatchObject({ outcome: "missing", corrected: true });
  });

  it("moves an unexpected ball here, with the count in the reason", async () => {
    const loc = await newLocation();
    const id = await receive(staff, {}, warehouse);
    const serial = await serialOf(id);
    const { id: count } = await start(staff, loc);
    await scan(staff, count, serial);
    await finish(staff, count);
    await correct(staff, count, serial);
    expect(await ballStatus(id)).toEqual({ status: "in_stock", location_id: loc });
    const move = (await movements(id)).at(-1);
    expect(move).toMatchObject({ type: "transfer", to_location_id: loc });
    expect(move.reason).toMatch(/^Found in the stock count of \d{4}-\d{2}-\d{2} at Count Shelf \d+$/);
    expect(line(await result(staff, count), serial)).toMatchObject({ corrected: true });
  });

  it("lets only the owner remove a missing ball or put a sold ball back", async () => {
    const loc = await newLocation();
    const missing = await receive(staff, {}, loc);
    const sold = await receive(staff, {}, loc);
    await as(staff, (c) => c.query("select public.sell_ball($1, $2)", [sold, randomUUID()]));
    const { id: count } = await start(staff, loc);
    await scan(staff, count, await serialOf(sold));
    await finish(staff, count);

    await expect(correct(staff, count, await serialOf(missing))).rejects.toThrow(/NOT_AUTHORIZED/);
    await expect(correct(staff, count, await serialOf(sold), "Sale was cancelled")).rejects.toThrow(/NOT_AUTHORIZED/);
    await expect(correct(owner, count, await serialOf(sold))).rejects.toThrow(/REASON_REQUIRED/);

    await correct(owner, count, await serialOf(missing));
    await correct(owner, count, await serialOf(sold), "Sale was cancelled");
    expect((await ballStatus(missing)).status).toBe("removed");
    expect((await movements(missing)).at(-1).reason).toMatch(/^Not found in the stock count of \d{4}-\d{2}-\d{2} at Count Shelf \d+$/);
    expect((await ballStatus(sold)).status).toBe("in_stock");
    expect((await movements(sold)).at(-1).reason).toMatch(/^Found in the stock count of .+: Sale was cancelled$/);
  });

  it("does not change stock a second time for a repeated correction, and refuses a line with no correction", async () => {
    const loc = await newLocation();
    const id = await receive(staff, {}, warehouse);
    const serial = await serialOf(id);
    const found = await receive(staff, {}, loc);
    const { id: count } = await start(staff, loc);
    await scan(staff, count, serial);
    await scan(staff, count, await serialOf(found));
    await scan(staff, count, "26NEWB00X005");
    await finish(staff, count);
    const requestId = randomUUID();
    await correct(staff, count, serial, null, requestId);
    await correct(staff, count, serial, null, requestId);
    expect((await movements(id)).filter((m) => m.type === "transfer")).toHaveLength(1);
    await expect(correct(staff, count, await serialOf(found))).rejects.toThrow(/NO_CORRECTION/);
    await expect(correct(staff, count, "26NEWB00X005")).rejects.toThrow(/NO_CORRECTION/);
    await expect(correct(staff, count, "26NOTIN0X999")).rejects.toThrow(/NO_CORRECTION/);
  });

  it("shows each correction in the activity feed with the count in the reason", async () => {
    const loc = await newLocation();
    const moved = await receive(staff, {}, warehouse);
    const missing = await receive(staff, {}, loc);
    const { id: count } = await start(staff, loc);
    await scan(staff, count, await serialOf(moved));
    await finish(staff, count);
    await correct(staff, count, await serialOf(moved));
    await correct(owner, count, await serialOf(missing));
    const rows = await as(staff, async (c) => (await c.query("select type, serial, reason from public.activity_feed(null, null, null, array['transfer', 'remove'], 10)")).rows);
    expect(rows).toContainEqual({ type: "transfer", serial: await serialOf(moved), reason: expect.stringMatching(/^Found in the stock count of .+ at Count Shelf/) });
    expect(rows).toContainEqual({ type: "remove", serial: await serialOf(missing), reason: expect.stringMatching(/^Not found in the stock count of .+ at Count Shelf/) });
  });

  it("moves a ball that was not recorded at the finish and was added to another location later", async () => {
    const loc = await newLocation();
    const serial = nextSerial();
    const { id: count } = await start(staff, loc);
    await scan(staff, count, serial);
    await finish(staff, count);
    const id = await receive(staff, { serial }, warehouse);
    expect(line(await result(staff, count), serial)).toMatchObject({ kind: "not_recorded", action: "move", corrected: false });
    await correct(staff, count, serial);
    expect(await ballStatus(id)).toEqual({ status: "in_stock", location_id: loc });
    expect(line(await result(staff, count), serial)).toMatchObject({ corrected: true, action: null });
  });

  it("refuses a correction from an open count", async () => {
    const loc = await newLocation();
    const id = await receive(staff, {}, warehouse);
    const { id: count } = await start(staff, loc);
    await scan(staff, count, await serialOf(id));
    await expect(correct(staff, count, await serialOf(id))).rejects.toThrow(/COUNT_NOT_FINISHED/);
  });

  it("lists finished counts, newest first, with names and totals", async () => {
    const loc = await newLocation();
    await receive(staff, {}, loc);
    const { id: count } = await start(staff, loc);
    await finish(secondStaff, count);
    const history = await as(staff, async (c) => (await c.query("select public.count_history() as r")).rows[0].r);
    expect(history[0]).toMatchObject({ id: count, started_by: "Staff", finished_by: "Second Staff", found: 0, missing: 1, unexpected: 0 });
    expect(history[0].location).toMatch(/^Count Shelf/);
  });
});
