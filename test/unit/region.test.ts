import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { RegionSnippet, ContentBlock } from '../../src/shared/types';

test('RegionSnippet - construct multimodal user content blocks with region', () => {
  const region: RegionSnippet = {
    data: 'dGVzdA==',
    mediaType: 'image/jpeg',
    x: 120,
    y: 250,
    w: 320,
    h: 180,
    elementsSummary: 'button: "立即购买"; span: "¥299"',
  };

  const userText = '提取价格并点击购买';
  const regionPrefix = `[User focused/selected region at viewport coordinates (x: ${region.x}, y: ${region.y}, width: ${region.w}, height: ${region.h})${
    region.elementsSummary ? ` containing elements: ${region.elementsSummary}` : ''
  }]:\n`;
  const promptText = regionPrefix + userText;

  const blocks: ContentBlock[] = [
    { type: 'text', text: promptText },
    { type: 'image', data: region.data, mediaType: region.mediaType },
  ];

  assert.equal(blocks.length, 2);
  assert.equal(blocks[0].type, 'text');
  assert.match((blocks[0] as any).text, /coordinates \(x: 120, y: 250, width: 320, height: 180\)/);
  assert.match((blocks[0] as any).text, /containing elements: button: "立即购买"/);
  assert.match((blocks[0] as any).text, /提取价格并点击购买/);
  assert.equal(blocks[1].type, 'image');
  assert.equal((blocks[1] as any).data, 'dGVzdA==');
});

test('RegionSnippet - empty user prompt defaults to analysis/extraction', () => {
  const region: RegionSnippet = {
    data: 'dGVzdA==',
    mediaType: 'image/jpeg',
    x: 50,
    y: 80,
    w: 200,
    h: 100,
  };

  const userText = '';
  const regionPrefix = `[User focused/selected region at viewport coordinates (x: ${region.x}, y: ${region.y}, width: ${region.w}, height: ${region.h})]:\n`;
  const promptText = regionPrefix + (userText || 'Please analyze, extract, or interact with this selected region.');

  assert.match(promptText, /Please analyze, extract, or interact with this selected region\./);
});
