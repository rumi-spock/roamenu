import { NativeModules, Platform } from 'react-native';

export type OcrBounds = {
  x: number;
  y: number;
  width: number;
  height: number;
};

export type OcrBlock = {
  text: string;
  bounds: OcrBounds;
};

export type MobileOcrResult = {
  text: string;
  blocks: OcrBlock[];
  dense: boolean;
};

type NativeFrame = {
  left: number;
  top: number;
  width: number;
  height: number;
};

type NativeBlock = {
  text?: string;
  frame?: NativeFrame;
};

type NativeOcrResult = {
  text?: string;
  blocks?: NativeBlock[];
};

type NativeTextRecognition = {
  recognize: (imageUri: string, script?: string) => Promise<NativeOcrResult>;
};

const nativeTextRecognition = NativeModules.TextRecognition as NativeTextRecognition | undefined;

function clamp(value: number): number {
  return Math.max(0, Math.min(1, value));
}

function normaliseBlock(frame: NativeFrame | undefined, imageWidth: number, imageHeight: number): OcrBounds | null {
  if (!frame || imageWidth <= 0 || imageHeight <= 0) return null;
  const x = clamp(frame.left / imageWidth);
  const y = clamp(frame.top / imageHeight);
  const right = clamp((frame.left + frame.width) / imageWidth);
  const bottom = clamp((frame.top + frame.height) / imageHeight);
  if (right <= x || bottom <= y) return null;
  return { x, y, width: right - x, height: bottom - y };
}

export async function inspectMenuImage(imageUri: string, imageWidth: number, imageHeight: number): Promise<MobileOcrResult | null> {
  if (Platform.OS === 'web' || !nativeTextRecognition) return null;
  try {
    const result = await nativeTextRecognition.recognize(imageUri, 'Latin');
    const blocks = (result.blocks ?? []).flatMap((block) => {
      const text = block.text?.trim();
      const bounds = normaliseBlock(block.frame, imageWidth, imageHeight);
      return text && bounds ? [{ text, bounds }] : [];
    });
    const text = result.text?.trim() ?? blocks.map((block) => block.text).join('\n');
    return { text, blocks, dense: blocks.length >= 35 || text.length >= 2500 };
  } catch {
    return null;
  }
}

export function findOcrBounds(itemName: string, blocks: OcrBlock[]): OcrBounds | undefined {
  const target = itemName.trim().toLocaleLowerCase();
  if (!target) return undefined;
  return blocks.find((block) => {
    const candidate = block.text.toLocaleLowerCase();
    return candidate.includes(target) || target.includes(candidate);
  })?.bounds;
}
