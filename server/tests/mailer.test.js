import { describe, expect, it } from "vitest";
import { parseAddress, sendViaBrevo, textToHtml } from "../src/lib/mailer.js";

describe("parseAddress", () => {
  it.each([
    ["JobTrack <promizygj@gmail.com>", { name: "JobTrack", email: "promizygj@gmail.com" }],
    ['"Job Track" <a@b.co>', { name: "Job Track", email: "a@b.co" }],
    ["<a@b.co>", { email: "a@b.co" }],
    ["  a@b.co ", { email: "a@b.co" }],
  ])("%s", (input, expected) => expect(parseAddress(input)).toEqual(expected));
});

describe("textToHtml", () => {
  it("escapes HTML, makes links clickable and keeps line breaks", () => {
    const html = textToHtml('Hi <Sam> & "co",\nVerify: https://jatracker.vercel.app/verify-email?token=abc_DEF-1');
    expect(html).toContain("Hi &lt;Sam&gt; &amp; &quot;co&quot;,<br>");
    expect(html).toContain('<a href="https://jatracker.vercel.app/verify-email?token=abc_DEF-1">');
    expect(html).not.toContain("<Sam>");
  });
});

describe("sendViaBrevo", () => {
  const email = { to: "user@example.com", subject: "Verify your JobTrack email", text: "Hi,\nhttps://x.test/verify-email?token=t" };

  it("posts to Brevo's transactional API with the api-key header and a time limit", async () => {
    let call;
    const fetchImpl = async (url, init) => {
      call = { url, init };
      return new Response(JSON.stringify({ messageId: "<1@relay>" }), { status: 201 });
    };
    await sendViaBrevo(email, { apiKey: "xkeysib-test", from: "JobTrack <promizygj@gmail.com>", fetchImpl });

    expect(call.url).toBe("https://api.brevo.com/v3/smtp/email");
    expect(call.init.method).toBe("POST");
    expect(call.init.headers["api-key"]).toBe("xkeysib-test");
    expect(call.init.signal).toBeInstanceOf(AbortSignal);
    const body = JSON.parse(call.init.body);
    expect(body).toMatchObject({
      sender: { name: "JobTrack", email: "promizygj@gmail.com" },
      to: [{ email: "user@example.com" }],
      subject: "Verify your JobTrack email",
      textContent: email.text,
    });
    expect(body.htmlContent).toContain('<a href="https://x.test/verify-email?token=t">');
  });

  it("throws with Brevo's error message on failure", async () => {
    const fetchImpl = async () => new Response('{"code":"unauthorized","message":"Key not found"}', { status: 401 });
    await expect(sendViaBrevo(email, { apiKey: "bad-key-123", from: "a@b.co", fetchImpl })).rejects.toThrow(/Brevo API 401: .*Key not found/);
  });
});
