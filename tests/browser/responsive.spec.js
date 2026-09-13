import { test, expect } from "@playwright/test";

const image = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aN1cAAAAASUVORK5CYII=",
  "base64",
);
const photo = {
  id: "a6b2d4e1-1222-4bc1-8b11-0f94b8121729",
  event_name: "A little memory with friends",
  created_at: "2026-09-13T00:00:00Z",
  image_url: "/api/photobooths/a6b2d4e1-1222-4bc1-8b11-0f94b8121729/image",
};
async function mockGallery(page) {
  await page.route("**/api/photobooths**", (route) => {
    if (route.request().url().endsWith("/image"))
      return route.fulfill({ contentType: "image/png", body: image });
    return route.fulfill({
      json: route.request().url().includes("/session/")
        ? [photo, { ...photo, id: "a6b2d4e1-1222-4bc1-8b11-0f94b8121730" }]
        : photo,
    });
  });
}
async function fits(page, name) {
  const dimensions = await page.evaluate(() => ({
    width: window.innerWidth,
    content: document.documentElement.scrollWidth,
  }));
  expect(dimensions.content, `${name}: document width`).toBeLessThanOrEqual(
    dimensions.width + 1,
  );
  const outside = await page
    .locator(
      "main input:not([type=checkbox]):not([type=range]):not([type=file]), main select, main .button, main .icon-button, main .remote-template-grid button",
    )
    .evaluateAll((elements) =>
      elements
        .filter((element) => {
          const bounds = element.getBoundingClientRect();
          return (
            bounds.width &&
            bounds.height &&
            (bounds.x < -1 || bounds.right > innerWidth + 1)
          );
        })
        .map(
          (element) =>
            element.getAttribute("aria-label") ||
            element.textContent.trim().slice(0, 60),
        ),
    );
  expect(outside, `${name}: usable controls stay on screen`).toEqual([]);
}

for (const [width, height] of [
  [320, 740],
  [390, 844],
  [768, 1024],
  [844, 390],
  [1024, 768],
  [1440, 900],
  [1920, 1080],
]) {
  test(`pages adapt to ${width}x${height}`, async ({ page }) => {
    await page.setViewportSize({ width, height });
    await mockGallery(page);
    for (const path of [
      "/",
      "/setup",
      "/together",
      "/together/create",
      "/together/join",
      "/gallery",
      `/photo/${photo.id}`,
    ]) {
      await page.goto(path);
      await expect(page.locator("main")).toBeVisible();
      if (path.startsWith("/photo/"))
        await expect(
          page.getByRole("button", { name: "Download PNG", exact: true }),
        ).toBeVisible();
      if (path === "/gallery")
        await expect(page.locator(".gallery-card")).toHaveCount(2);
      await fits(page, path);
      if (
        (width === 320 || width === 768) &&
        ["/together/create", "/"].includes(path)
      )
        await page.screenshot({
          path: `test-results/responsive-${width}-${path === "/" ? "home" : "create"}.png`,
          fullPage: true,
        });
    }
    await page.getByRole("button", { name: "QR code", exact: true }).click();
    const modal = page.locator(".qr-modal");
    await expect(modal).toBeVisible();
    const bounds = await modal.boundingBox();
    expect(bounds.x).toBeGreaterThanOrEqual(0);
    expect(bounds.y).toBeGreaterThanOrEqual(0);
    expect(bounds.x + bounds.width).toBeLessThanOrEqual(width);
    expect(bounds.y + bounds.height).toBeLessThanOrEqual(height);
    await page.getByRole("button", { name: "Close QR code" }).click();
  });
}

for (const width of [320, 768, 1440]) {
  const participantTotal = width === 1440 ? 2 : 4;
  const layoutId =
    participantTotal === 2 ? "remote-duo-grid" : "remote-2x2-squad";
  test(`live room and settings adapt at ${width}px with ${participantTotal} participants`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 900 });
    const participantId = "e9a434dd-88da-41da-aef2-678f64724123";
    const credentials = {
      participantId,
      participantToken: "fixture-token",
      hostToken: "fixture-host-token",
      roomCode: "TST123",
    };
    await page.addInitScript(
      (credentials) =>
        sessionStorage.setItem(
          "photobooth_room_TST123",
          JSON.stringify(credentials),
        ),
      credentials,
    );
    const participants = Array.from(
      { length: participantTotal },
      (_, index) => ({
        participant_id: index
          ? `e9a434dd-88da-41da-aef2-678f6472412${index + 3}`
          : participantId,
        display_name: index
          ? "A friend with a long display name"
          : "Pitik test",
        status: "not_ready",
        camera_enabled: false,
        ready: false,
        joined_at: new Date().toISOString(),
        last_seen_at: new Date().toISOString(),
      }),
    );
    const snapshot = {
      room: {
        id: "e9a434dd-88da-41da-aef2-678f64724120",
        room_code: "TST123",
        host_participant_id:
          width === 768 ? participants[1].participant_id : participantId,
        status: "lobby",
        max_participants: participantTotal,
        photo_count: 9,
        current_round: 0,
        countdown_seconds: 3,
        auto_continue: false,
        layout: layoutId,
        frame: "classic-white",
        roster: [],
        version: 1,
        created_at: new Date().toISOString(),
      },
      participants,
      photos: [],
    };
    await page.route("**/api/rooms/**", (route) => {
      if (route.request().url().endsWith("/events")) return route.abort();
      return route.fulfill({ json: snapshot });
    });
    await page.goto("/room/TST123");
    await expect(
      page.getByRole("heading", { name: "Your people. In the moment." }),
    ).toBeVisible();
    await expect(page.locator(".participant-video")).toHaveCount(
      participantTotal,
    );
    await expect(page.locator(".live-layout-shell")).toHaveAttribute(
      "data-layout",
      layoutId,
    );
    const sharedFrame = await page
      .locator(".participant-video")
      .evaluateAll((videos) => {
        const shell = videos[0]?.closest(".live-layout-shell");
        const bounds = shell?.getBoundingClientRect();
        return (
          !!shell &&
          videos.every(
            (video) =>
              video.closest(".live-layout-shell") === shell &&
              video.getBoundingClientRect().left >= bounds.left &&
              video.getBoundingClientRect().right <= bounds.right,
          )
        );
      });
    expect(sharedFrame).toBe(true);
    await fits(page, "live room");
    await page.getByRole("button", { name: "Choose our shared setup" }).click();
    await expect(
      page.getByLabel(`Layout for ${participantTotal} people`),
    ).toBeVisible();
    if (width === 768) {
      await expect(
        page.getByText("Anyone in the room can update these shared settings"),
      ).toBeVisible();
      await expect(page.getByRole("button", { name: "End room" })).toHaveCount(
        0,
      );
    }
    await fits(page, "room settings");
    await page.screenshot({
      path: `test-results/room-${width}.png`,
      fullPage: true,
    });
  });
}

for (const width of [320, 768]) {
  test(`solo camera, editor and result adapt at ${width}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 844 });
    await page.goto("/setup");
    const layoutName = width === 320 ? "3x3 Grid" : "Single Polaroid";
    await page
      .getByRole("textbox", { name: "Search layouts" })
      .fill(layoutName);
    await page.getByRole("button", { name: `Preview ${layoutName}` }).click();
    await page.getByRole("button", { name: "Use this layout" }).click();
    await fits(page, "solo customization");
    await page.getByRole("button", { name: "Let’s take some photos" }).click();
    await expect(
      page.getByRole("button", { name: "Start session", exact: true }),
    ).toBeVisible();
    await fits(page, "solo camera");
    await page.locator("input[type=file]").setInputFiles(
      Array.from({ length: width === 320 ? 9 : 1 }, (_, index) => ({
        name: `test-${index}.png`,
        mimeType: "image/png",
        buffer: image,
      })),
    );
    await expect(page).toHaveURL(/\/edit$/);
    await fits(page, "editor");
    await page.getByRole("button", { name: "Create my photobooth" }).click();
    await expect(page.getByAltText("Your finished photobooth")).toBeVisible();
    await fits(page, "result");
  });
}
