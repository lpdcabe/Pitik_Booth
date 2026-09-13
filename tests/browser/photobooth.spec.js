import { test, expect } from "@playwright/test";
test("desktop capture, edit, retake, export, and honest cloud error", async ({
  page,
}) => {
  const errors = [];
  await page.route("**/api/photobooths**", (route) =>
    route.fulfill({
      status: 503,
      json: { error: "Cloud storage is not configured." },
    }),
  );
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: /Little moments\. Big memories/ }),
  ).toBeVisible();
  await page.screenshot({
    path: "test-results/home-desktop.png",
    fullPage: true,
  });
  await page
    .getByRole("link", { name: "Start photobooth", exact: true })
    .click();
  await page.getByRole("button", { name: "Use this layout" }).click();
  await page.getByRole("button", { name: "Let’s take some photos" }).click();
  await expect(
    page.getByRole("button", { name: "Start session", exact: true }),
  ).toBeEnabled();
  await page
    .getByRole("button", { name: "Start session", exact: true })
    .click();
  await expect(page).toHaveURL(/\/edit$/, { timeout: 25000 });
  await expect(page.getByAltText("Editing photo 1")).toBeVisible();
  await page.getByRole("button", { name: "Sepia", exact: true }).click();
  await page.getByRole("link", { name: "Retake", exact: true }).click();
  await page
    .getByRole("button", { name: "Retake this photo", exact: true })
    .click();
  await expect(page).toHaveURL(/\/edit$/, { timeout: 10000 });
  await page.getByRole("button", { name: "Create my photobooth" }).click();
  await expect(page.getByAltText("Your finished photobooth")).toBeVisible();
  const downloaded = page.waitForEvent("download");
  await page.getByRole("button", { name: "Download PNG" }).click();
  expect((await downloaded).suggestedFilename()).toMatch(/photobooth-.*\.png/);
  const jpg = page.waitForEvent("download");
  await page.getByRole("button", { name: "JPG", exact: true }).click();
  expect((await jpg).suggestedFilename()).toMatch(/photobooth-.*\.jpg/);
  await page.getByRole("button", { name: "Save to my gallery" }).click();
  await expect(page.getByRole("status")).toContainText("not configured");
  await page.screenshot({
    path: "test-results/result-desktop.png",
    fullPage: true,
  });
  expect(errors).toEqual([]);
});
test("mobile layout search, favorites, customization, navigation and no overflow", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.route("**/api/photobooths**", (route) =>
    route.fulfill({
      status: 503,
      json: { error: "Cloud storage is not configured." },
    }),
  );
  await page.goto("/");
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: "test-results/home-mobile.png",
    fullPage: true,
  });
  await page.getByRole("link", { name: "Layouts", exact: true }).click();
  await page.getByRole("textbox", { name: "Search layouts" }).fill("9 photos");
  await expect(
    page.getByRole("button", { name: "Preview 3x3 Grid" }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Favorite 3x3 Grid", exact: true })
    .click();
  await page.getByRole("textbox", { name: "Search layouts" }).fill("");
  await page.getByRole("button", { name: "Favorites", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Preview 3x3 Grid" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Preview 3x3 Grid" }).click();
  await page.getByRole("button", { name: "Use this layout" }).click();
  await page
    .getByRole("textbox", { name: "Event name", exact: true })
    .fill("Our favorite day");
  await page.getByRole("button", { name: "Pink", exact: true }).click();
  await page.screenshot({
    path: "test-results/setup-mobile.png",
    fullPage: true,
  });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await page.getByRole("link", { name: "My gallery" }).click();
  await expect(
    page.getByText("Your gallery isn’t available yet."),
  ).toBeVisible();
});
test("all layouts render using the reusable engine including masks and duplicate strips", async ({
  page,
}) => {
  await page.goto("/");
  const result = await page.evaluate(async () => {
    const { layouts } = await import("/src/utils/layouts.js");
    const { frames } = await import("/src/utils/frames.js");
    const { generateCanvas } = await import("/src/utils/canvasGenerator.js");
    const source = document.createElement("canvas");
    source.width = 100;
    source.height = 80;
    const c = source.getContext("2d");
    c.fillStyle = "red";
    c.fillRect(0, 0, 100, 80);
    const photos = Array.from({ length: 9 }, () => ({
      src: source.toDataURL(),
      filter: "Sepia",
      zoom: 1.1,
      panX: 40,
      adjustments: { grain: 2 },
    }));
    for (const layout of layouts) {
      const output = await generateCanvas(
        {
          layout,
          frame: frames[0],
          photos,
          settings: {
            eventName: "Test memory",
            message: "A day to remember",
            showDate: true,
          },
        },
        0.1,
      );
      if (!output.toDataURL().startsWith("data:image/png"))
        throw new Error(layout.name);
      if (layout.name === "Classic Film Strip") {
        const last = layout.slots.at(-1);
        const pixel = output
          .getContext("2d")
          .getImageData(
            Math.floor((last.x + last.width / 2) * 0.1),
            Math.floor((last.y + last.height / 2) * 0.1),
            1,
            1,
          ).data;
        if (pixel[0] > 230 && pixel[1] > 230)
          throw new Error("Film decorations covered the final photo");
      }
    }
    const { filteredBitmap } = await import("/src/utils/filterFallback.js");
    const fallback = filteredBitmap(source, "grayscale(1)");
    const pixel = fallback.getContext("2d").getImageData(0, 0, 1, 1).data;
    if (pixel[0] !== pixel[1] || pixel[1] !== pixel[2])
      throw new Error("Pixel grayscale fallback failed");
    const duplicate = await generateCanvas(
      {
        layout: layouts.find((l) => l.duplicate),
        frame: frames[10],
        photos,
        settings: { eventName: "Same memory", logo: source.toDataURL() },
      },
      0.1,
    );
    const duplicateContext = duplicate.getContext("2d");
    const first = duplicateContext.getImageData(
      0,
      0,
      duplicate.width / 2,
      duplicate.height,
    ).data;
    const second = duplicateContext.getImageData(
      duplicate.width / 2,
      0,
      duplicate.width / 2,
      duplicate.height,
    ).data;
    if (!first.every((value, index) => value === second[index]))
      throw new Error("Print strips are not identical");
    return layouts.length;
  });
  expect(result).toBeGreaterThanOrEqual(80);
});
test("uploaded photo, saved result, QR code, session gallery and delete with a cloud API test double", async ({
  page,
}) => {
  const id = "a6b2d4e1-1222-4bc1-8b11-0f94b8121729";
  let saved = false;
  const fixture = {
    id,
    event_name: "little moments",
    created_at: new Date().toISOString(),
    expires_at: null,
    image_url: `/api/photobooths/${id}/image`,
    share_url: `http://localhost:5173/photo/${id}`,
  };
  const png = Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aN1cAAAAASUVORK5CYII=",
    "base64",
  );
  await page.route("**/api/photobooths**", async (route) => {
    const request = route.request(),
      url = new URL(request.url());
    if (request.method() === "POST") {
      saved = true;
      return route.fulfill({ status: 201, json: fixture });
    }
    if (request.method() === "DELETE") {
      saved = false;
      return route.fulfill({ status: 204 });
    }
    if (url.pathname.endsWith("/image"))
      return route.fulfill({ contentType: "image/png", body: png });
    if (url.pathname.includes("/session/"))
      return route.fulfill({ json: saved ? [fixture] : [] });
    return route.fulfill({ json: fixture });
  });
  await page.goto("/setup");
  await page
    .getByRole("textbox", { name: "Search layouts" })
    .fill("Single Polaroid");
  await page.getByRole("button", { name: "Preview Single Polaroid" }).click();
  await page.getByRole("button", { name: "Use this layout" }).click();
  await page.getByRole("button", { name: "Let’s take some photos" }).click();
  await page
    .locator("input[type=file]")
    .setInputFiles({ name: "memory.png", mimeType: "image/png", buffer: png });
  await expect(page).toHaveURL(/\/edit$/);
  await page.getByRole("button", { name: "Create my photobooth" }).click();
  await expect(page.getByAltText("Your finished photobooth")).toBeVisible();
  await page.getByRole("button", { name: "Save to my gallery" }).click();
  await expect(
    page.getByRole("button", { name: "Saved to your gallery" }),
  ).toBeDisabled();
  await page.getByRole("button", { name: "QR code", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Scan to download" }),
  ).toBeVisible();
  await expect(
    page.getByAltText("QR code linking to this photobooth"),
  ).toBeVisible();
  await page.getByRole("button", { name: "Close QR code" }).click();
  await page.getByRole("link", { name: "My gallery" }).click();
  await expect(page.getByAltText("little moments")).toBeVisible();
  await page.getByRole("button", { name: "Delete photo" }).click();
  await page
    .getByRole("button", { name: "Delete memory", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Your first memory starts here." }),
  ).toBeVisible();
});
