import { test, expect, type Page } from '@playwright/test';
import fs from 'node:fs/promises';
import path from 'node:path';

// 쇼츠(세로) 작품(2026-11-22 사용자 요청, 영상 계약 §2 orientation): 새 작품을 만들 때 가로 영상·쇼츠를 고르고, 고른 방향은 넣는 영상과 관계없이 그대로다.
// 고치기 전에는 고르는 곳이 없고 첫 영상의 방향으로 정해져, 가로로 찍은 영상으로는 쇼츠를 만들 수 없었다.
const FIXTURE = 'tests/fixtures/video';
const OUT = 'artifacts/video-shorts';
const status = (page: Page) => page.getByRole('status');
const doc = (page: Page) => page.evaluate(() => JSON.parse(JSON.stringify((window as any).__canvacraftVideo.store.getProject())));
const chooser = (page: Page) => page.getByRole('dialog', { name: '새 영상 고르기' });
const playing = (page: Page) => page.evaluate(() => (window as any).__canvacraftVideo.player.state.playing as boolean);
const saveState = (page: Page) => page.getByTestId('save-state');
const file = async (name: string) => ({ name, mimeType: 'video/webm', buffer: await fs.readFile(path.join(FIXTURE, name)) });

async function videoHome(page: Page) {
  await page.goto('/');
  await page.getByRole('button', { name: '영상 만들기' }).click();
  await expect(page.getByRole('list', { name: '내 영상' })).toBeAttached();
}

test('쇼츠를 고르면 세로 작품이 되고, 가로 영상을 넣어도 세로 그대로이며, MP4가 1080×1920으로 위아래가 검게 나온다', async ({ page }) => {
  await videoHome(page);
  await page.getByRole('button', { name: '새 작품' }).click();
  await expect(chooser(page).getByRole('button', { name: '가로 영상' })).toBeFocused();
  await chooser(page).getByRole('button', { name: '쇼츠' }).click();
  await expect(chooser(page)).toBeHidden();
  await expect(page.getByTestId('video-stage')).toHaveClass(/portrait/);
  expect(await doc(page)).toMatchObject({ orientation: 'portrait', clips: [] });

  // a.webm은 가로(320×180) 영상이다. 고치기 전에는 첫 영상이 가로라 가로 작품으로 바뀌었다.
  await page.getByTestId('import-video').setInputFiles(await file('a.webm'));
  await expect(status(page)).toContainText('영상을 넣었어요', { timeout: 20000 });
  const project = await doc(page);
  expect(project).toMatchObject({ orientation: 'portrait', fps: 30 });
  await expect(page.getByTestId('video-stage')).toHaveClass(/portrait/);
  const stage = (await page.getByTestId('video-stage').boundingBox())!;
  expect(stage.height).toBeGreaterThan(stage.width * 1.7);
  await fs.mkdir(OUT, { recursive: true });
  await page.screenshot({ path: path.join(OUT, 'shorts-editor.png') });

  const waiting = page.waitForEvent('download', { timeout: 60000 });
  await page.getByRole('button', { name: '내보내기' }).click();
  const download = await waiting;
  const saved = path.join(OUT, 'shorts.mp4'); await download.saveAs(saved);
  await page.getByRole('dialog', { name: '내보내기 결과' }).getByRole('button', { name: '닫기' }).click();

  // 1초 프레임에서 위쪽 여백(검정)과 가운데(영상)의 밝기를 잰다. 320×180 영상을 폭 1080에 맞추면 높이 608, 위아래 656씩 검다.
  const base64 = (await fs.readFile(saved)).toString('base64');
  const info = await page.evaluate(async base64 => {
    const mb = await import('/node_modules/mediabunny/dist/modules/src/index.js' as string);
    const bytes = Uint8Array.from(atob(base64), char => char.charCodeAt(0));
    const input = new mb.Input({ formats: mb.ALL_FORMATS, source: new mb.BufferSource(bytes) });
    const video = await input.getPrimaryVideoTrack();
    const canvas = new OffscreenCanvas(video.displayWidth, video.displayHeight); const ctx = canvas.getContext('2d', { willReadFrequently: true })!;
    const sample = await new mb.VideoSampleSink(video).getSample(1.0 + 1 / 60);
    sample.draw(ctx, 0, 0); sample.close();
    const light = (x: number, y: number) => { const [r, g, b] = ctx.getImageData(x, y, 1, 1).data; return r + g + b; };
    const result = { mime: await input.getMimeType(), width: video.displayWidth, height: video.displayHeight, top: light(540, 200), bottom: light(540, 1720), middle: light(100, 960) };
    input.dispose();
    return result;
  }, base64);
  console.log(JSON.stringify(info));
  expect(info.mime).toContain('video/mp4');
  expect([info.width, info.height]).toEqual([1080, 1920]);
  expect(info.top).toBeLessThan(30);
  expect(info.bottom).toBeLessThan(30);
  expect(info.middle).toBeGreaterThan(100);
});

test('파일 → 새 작품도 먼저 묻고, 취소·Escape면 지금 작품 그대로다. 고르는 동안 스페이스는 재생하지 않고, 손대지 않은 새 쇼츠는 목록에 남지 않는다', async ({ page }) => {
  await videoHome(page);
  await page.getByRole('button', { name: '새 작품' }).click();
  await chooser(page).getByRole('button', { name: '가로 영상' }).click();
  await page.getByTestId('import-video').setInputFiles(await file('a.webm'));
  await expect(status(page)).toContainText('영상을 넣었어요', { timeout: 20000 });
  await expect(saveState(page)).toHaveText('저장됨', { timeout: 5000 });
  const first = await doc(page);
  expect(first.orientation).toBe('landscape');

  const openChooser = async () => {
    await page.getByRole('button', { name: '파일' }).click();
    await page.getByRole('menuitem', { name: '새 작품' }).click();
    await expect(chooser(page)).toBeVisible();
  };
  await openChooser();
  await page.keyboard.press('Escape');
  await expect(chooser(page)).toBeHidden();
  expect((await doc(page)).id).toBe(first.id);

  await openChooser();
  await chooser(page).getByRole('button', { name: '취소' }).click();
  await expect(chooser(page)).toBeHidden();
  expect((await doc(page)).id).toBe(first.id);

  // 창 안에서 스페이스는 재생이 아니라 초점이 있는 단추(가로 영상)를 누른다.
  await openChooser();
  await page.keyboard.press(' ');
  await expect(chooser(page)).toBeHidden();
  await expect.poll(async () => (await doc(page)).id).not.toBe(first.id);
  expect(await playing(page)).toBe(false);
  const blank = await doc(page);
  expect(blank).toMatchObject({ orientation: 'landscape', clips: [] });
  expect(blank.id).not.toBe(first.id);

  await page.getByRole('button', { name: '작품 목록' }).click();
  await expect(page.getByRole('list', { name: '내 영상' }).getByRole('listitem')).toHaveCount(1);
  await page.getByRole('button', { name: '새 작품' }).click();
  await chooser(page).getByRole('button', { name: '쇼츠' }).click();
  await expect(page.getByTestId('video-stage')).toHaveClass(/portrait/);
  const shorts = await doc(page);
  expect(shorts.id).not.toBe(first.id);
  expect(shorts).toMatchObject({ orientation: 'portrait', clips: [] });
  await expect(saveState(page)).toHaveText('새 작품');
  await page.getByRole('button', { name: '작품 목록' }).click();
  await expect(page.getByRole('list', { name: '내 영상' }).getByRole('listitem')).toHaveCount(1);
});
