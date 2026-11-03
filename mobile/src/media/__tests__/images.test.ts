import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import * as ImagePicker from 'expo-image-picker';

import { mockFetch } from '@/test-utils';

import {
  compressImage,
  fitWithin,
  pickImages,
  UploadError,
  uploadToTicket,
  type UploadTicket,
} from '../images';

jest.mock('expo-image-picker', () => ({
  launchImageLibraryAsync: jest.fn(),
  getMediaLibraryPermissionsAsync: jest.fn(),
}));

const context = { resize: jest.fn(), renderAsync: jest.fn() };
jest.mock('expo-image-manipulator', () => ({
  SaveFormat: { JPEG: 'jpeg' },
  ImageManipulator: { manipulate: jest.fn() },
}));

const picker = jest.mocked(ImagePicker);
const manipulate = jest.mocked(ImageManipulator.manipulate);

beforeEach(() => {
  jest.clearAllMocks();
  const saveAsync = jest.fn(async () => ({ uri: 'file:///out.jpg', width: 2048, height: 1536 }));
  context.renderAsync.mockResolvedValue({ saveAsync });
  manipulate.mockReturnValue(context as never);
});

describe('fitWithin', () => {
  it.each([
    [4032, 3024, { width: 2048 }],
    [3024, 4032, { height: 2048 }],
    [3000, 3000, { width: 2048 }],
    [2048, 1000, null],
    [800, 600, null],
  ])('%d x %d -> %j', (w, h, expected) => {
    expect(fitWithin(w, h)).toEqual(expected);
  });
});

describe('compressImage', () => {
  it('downscales the longest side to 2048 px and saves as JPEG 0.8', async () => {
    const out = await compressImage({ uri: 'file:///in.heic', width: 4032, height: 3024 });
    expect(manipulate).toHaveBeenCalledWith('file:///in.heic');
    expect(context.resize).toHaveBeenCalledWith({ width: 2048 });
    const rendered = await context.renderAsync.mock.results[0]?.value;
    expect(rendered.saveAsync).toHaveBeenCalledWith({ compress: 0.8, format: SaveFormat.JPEG });
    expect(out).toEqual({ uri: 'file:///out.jpg', width: 2048, height: 1536 });
  });

  it('never upscales a small photo, but still re-encodes it', async () => {
    await compressImage({ uri: 'file:///small.jpg', width: 900, height: 1200 });
    expect(context.resize).not.toHaveBeenCalled();
    expect(context.renderAsync).toHaveBeenCalled();
  });
});

describe('pickImages', () => {
  it('returns the picked images, capped to the remaining slots', async () => {
    picker.launchImageLibraryAsync.mockResolvedValue({
      canceled: false,
      assets: [
        { uri: 'a', width: 1, height: 1 },
        { uri: 'b', width: 2, height: 2 },
        { uri: 'c', width: 3, height: 3 },
      ],
    } as never);
    const result = await pickImages(2);
    expect(result).toEqual({
      status: 'picked',
      images: [
        { uri: 'a', width: 1, height: 1 },
        { uri: 'b', width: 2, height: 2 },
      ],
    });
    expect(picker.launchImageLibraryAsync).toHaveBeenCalledWith(
      expect.objectContaining({ selectionLimit: 2, allowsMultipleSelection: true, exif: false }),
    );
  });

  it('reports a cancelled picker', async () => {
    picker.launchImageLibraryAsync.mockResolvedValue({ canceled: true, assets: null } as never);
    expect(await pickImages(10)).toEqual({ status: 'cancelled' });
  });

  it('does not open the picker when no slot is left', async () => {
    expect(await pickImages(0)).toEqual({ status: 'cancelled' });
    expect(picker.launchImageLibraryAsync).not.toHaveBeenCalled();
  });

  it('turns a refused permission into "denied" instead of crashing', async () => {
    picker.launchImageLibraryAsync.mockRejectedValue(new Error('E_NO_PERMISSIONS'));
    picker.getMediaLibraryPermissionsAsync.mockResolvedValue({ granted: false } as never);
    expect(await pickImages(3)).toEqual({ status: 'denied' });
  });

  it('rethrows other picker failures', async () => {
    picker.launchImageLibraryAsync.mockRejectedValue(new Error('boom'));
    picker.getMediaLibraryPermissionsAsync.mockResolvedValue({ granted: true } as never);
    await expect(pickImages(3)).rejects.toThrow('picker_failed');
  });
});

describe('uploadToTicket', () => {
  const ticket: UploadTicket = {
    key: 'couples/3/memories/abc.jpg',
    url: 'https://s3.test/bucket',
    form_fields: { key: 'couples/3/memories/abc.jpg', 'Content-Type': 'image/jpeg', policy: 'p' },
  };

  it('posts the signed fields then the file to storage', async () => {
    const fetch = mockFetch();
    fetch.mockResolvedValue(new Response(null, { status: 204 }));
    await uploadToTicket(ticket, { uri: 'file:///out.jpg', width: 10, height: 10 });

    const [url, init] = fetch.mock.calls[0] ?? [];
    expect(url).toBe('https://s3.test/bucket');
    expect(init?.method).toBe('POST');
    const form = init?.body as FormData;
    expect(form).toBeInstanceOf(FormData);
  });

  it('fails with the storage status when the upload is refused', async () => {
    mockFetch().mockResolvedValue(new Response('too big', { status: 400 }));
    await expect(
      uploadToTicket(ticket, { uri: 'file:///out.jpg', width: 10, height: 10 }),
    ).rejects.toEqual(new UploadError(400));
  });
});
