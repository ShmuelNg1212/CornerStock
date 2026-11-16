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
