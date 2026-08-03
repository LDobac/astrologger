import satori, { type SatoriOptions } from "satori";
import sharp from "sharp";

/*
 * satori로 SVG를 그린 뒤 sharp로 PNG 래스터라이즈한다. satori는 텍스트를 <path>로
 * 벡터화해서 내보내므로 이 단계에서는 폰트 의존이 없다(폰트는 satori 호출 시에만 필요).
 * 이전에는 @vercel/og(ImageResponse)가 내부적으로 satori + @resvg/resvg-wasm으로
 * 같은 일을 했는데, PNG 경로와 SVG 경로가 서로 다른 satori 버전을 쓰는 문제가 있었다.
 * satori + sharp로 통합해 두 경로가 항상 같은 렌더러를 쓰게 한다.
 */
export default async function RenderOgPng(
    element: Parameters<typeof satori>[0],
    options: SatoriOptions & { width: number; height: number },
): Promise<ArrayBuffer> {
    const svg = await satori(element, options);
    const png = await sharp(Buffer.from(svg))
        .resize(options.width, options.height)
        .png()
        .toBuffer();

    return png.buffer.slice(png.byteOffset, png.byteOffset + png.byteLength) as ArrayBuffer;
}
