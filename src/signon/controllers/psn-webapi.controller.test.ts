import type { AddressInfo } from "node:net";
import { type INestApplication, Module } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import { ExpressAdapter } from "@nestjs/platform-express";
import express from "express";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { PsnWebApiController } from "./psn-webapi.controller";

@Module({ controllers: [PsnWebApiController] })
class PsnWebApiTestModule {}

let app: INestApplication;
let base: string;

beforeAll(async () => {
  const server = express();
  server.use(express.raw({ type: () => true, limit: "1mb" }));
  app = await NestFactory.create(
    PsnWebApiTestModule,
    new ExpressAdapter(server),
    { bodyParser: false, logger: false }
  );
  await app.listen(0, "127.0.0.1");
  const { port } = app.getHttpServer().address() as AddressInfo;
  base = `http://127.0.0.1:${port}`;
});

afterAll(async () => {
  await app.close();
});

describe("PSN WebAPI", () => {
  it("serves an empty friend list from the asked offset", async () => {
    const res = await fetch(
      `${base}/v1/users/craftycodie/friendList?fields=onlineId&friendStatus=friend&presenceType=primary&offset=0&limit=100`
    );
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toBe("application/json");
    const body = await res.text();
    expect(body).toBe('{"friendList":[],"size":0,"start":0,"totalResults":0}');
    expect(body.length).toBe(53);
  });

  it("refuses a bad friend list offset", async () => {
    const res = await fetch(
      `${base}/v1/users/craftycodie/friendList?offset=-1`
    );
    expect(res.status).toBe(400);
  });

  it("takes gameStatus and gameData presence", async () => {
    for (const kind of ["gameStatus", "gameData"]) {
      const res = await fetch(`${base}/v1/users/craftycodie/presence/${kind}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ gameStatus: "In orbit" }),
      });
      expect(res.status).toBe(204);
      expect(await res.text()).toBe("");
    }
  });

  it("has no other presence field", async () => {
    const res = await fetch(`${base}/v1/users/craftycodie/presence/unknown`, {
      method: "PUT",
      body: "{}",
    });
    expect(res.status).toBe(404);
  });

  it("creates sessions with ids the client can hold", async () => {
    const boundary = "session-boundary";
    const body = [
      `--${boundary}`,
      "Content-Type: application/json; charset=utf-8",
      "Content-Description: session-request",
      "",
      '{"sessionType":"owner-bind","sessionPrivacy":"public","sessionMaxUser":3}',
      `--${boundary}`,
      "Content-Type: image/jpeg",
      "Content-Description: session-image",
      "",
      "\xff\xd8\xff\xd9",
      `--${boundary}--`,
      "",
    ].join("\r\n");
    const ids = new Set<string>();
    for (let i = 0; i < 2; i++) {
      const res = await fetch(`${base}/v1/sessions`, {
        method: "POST",
        headers: { "Content-Type": `multipart/mixed; boundary=${boundary}` },
        body,
      });
      expect(res.status).toBe(200);
      expect(res.headers.get("content-type")).toBe("application/json");
      const { sessionId } = (await res.json()) as { sessionId: string };
      // what the client's round trip accepts (newSessionId)
      expect(sessionId).toMatch(
        /^[0-9a-f]{3}-[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/
      );
      expect(encodeURIComponent(sessionId)).toBe(sessionId);
      ids.add(sessionId);
    }
    expect(ids.size).toBe(2);
  });

  it("updates and deletes sessions", async () => {
    const created = await fetch(`${base}/v1/sessions`, {
      method: "POST",
      body: "",
    });
    const { sessionId } = (await created.json()) as { sessionId: string };
    const put = await fetch(`${base}/v1/sessions/${sessionId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sessionLockFlag: false }),
    });
    expect(put.status).toBe(204);
    const del = await fetch(`${base}/v1/sessions/${sessionId}`, {
      method: "DELETE",
    });
    expect(del.status).toBe(204);
  });
});
