import { test, expect } from "@playwright/test";

test("room creation collects the people first and preserves shared defaults", async ({
  page,
}) => {
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  let submitted;
  await page.route("**/api/rooms", (route) => {
    submitted = route.request().postDataJSON();
    return route.fulfill({
      status: 201,
      json: {
        room: { room_code: "TST123" },
        participants: [],
        photos: [],
        credentials: {
          participantId: submitted.participantId,
          participantToken: "test-participant-token",
          hostToken: "test-host-token",
        },
        inviteUrl: "http://localhost:5173/room/TST123?invite=test-invitation",
      },
    });
  });
  await page.goto("/together");
  await expect(page.locator(".together-choices")).toHaveCSS("display", "grid");
  const cards = await page.locator(".together-choice").all();
  expect((await cards[0].boundingBox()).y).toEqual(
    (await cards[1].boundingBox()).y,
  );
  await page.screenshot({
    path: "test-results/together-desktop.png",
    fullPage: true,
  });
  await page.getByRole("link", { name: /Make room for your people/ }).click();
  await expect(
    page.getByRole("button", { name: "Create room", exact: true }),
  ).toBeDisabled();
  await page.getByLabel("Your display name").fill("Pitik test");
  await page.getByLabel("Maximum participants").selectOption("3");
  await expect(page.getByLabel("Layout for 3 people")).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "Pink", exact: true }),
  ).toHaveCount(0);
  await page.screenshot({
    path: "test-results/create-room-desktop.png",
    fullPage: true,
  });
  await page.getByRole("button", { name: "Create room", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Your room code" }),
  ).toBeVisible();
  await expect(page.getByLabel("Invite link")).toHaveValue(/TST123/);
  expect(submitted).toMatchObject({
    displayName: "Pitik test",
    maxParticipants: 3,
    photoCount: 4,
    countdownSeconds: 3,
    autoContinue: false,
    layout: "remote-trio-grid",
    frame: "classic-white",
  });
  expect(
    await page.evaluate(
      () =>
        JSON.parse(sessionStorage.getItem("photobooth_room_TST123"))
          .participantToken,
    ),
  ).toBe("test-participant-token");
  await page.getByRole("button", { name: "QR code", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Scan to download" }),
  ).toBeVisible();
  expect(errors).toEqual([]);
});

for (const scenario of [
  {
    name: "network failure",
    respond: (route) => route.abort("connectionrefused"),
    message: /couldn't reach the room server/,
  },
  {
    name: "frontend HTML fallback",
    respond: (route) =>
      route.fulfill({
        contentType: "text/html",
        body: "<!doctype html><title>Pitik Booth</title>",
      }),
    message: /unexpected response/,
  },
  {
    name: "missing database migration",
    respond: (route) =>
      route.fulfill({
        status: 503,
        json: {
          error:
            "Booth Together needs its database migration. Please ask the site owner to finish setup.",
        },
      }),
    message: /finish setup/,
  },
]) {
  test(`room creation recovers from ${scenario.name}`, async ({ page }) => {
    await page.route("**/api/rooms", scenario.respond);
    await page.goto("/together/create");
    await page.getByLabel("Your display name").fill("Pitik test");
    await page
      .getByRole("button", { name: "Create room", exact: true })
      .click();
    await expect(page.getByRole("alert")).toContainText(scenario.message);
    await expect(
      page.getByRole("button", { name: "Create room", exact: true }),
    ).toBeEnabled();
  });
}
