import { Config } from '@remotion/cli/config';

Config.setEntryPoint('./src/index.ts');
Config.setVideoImageFormat('png'); // the layer is composited over the Blender render: keep alpha, no JPEG
Config.setCodec('h264');
Config.setCrf(16);
Config.setPixelFormat('yuv420p');
Config.setConcurrency(8); // 01-MOTION §4; never while a long Blender render runs (see README)
