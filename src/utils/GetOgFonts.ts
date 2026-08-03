// Regular Font
const fontFileRegular = await fetch(
    "https://www.1001fonts.com/download/font/ibm-plex-mono.regular.ttf"
);
const fontRegular: ArrayBuffer = await fontFileRegular.arrayBuffer();

// Bold Font
const fontFileBold = await fetch(
    "https://www.1001fonts.com/download/font/ibm-plex-mono.bold.ttf"
);
const fontBold: ArrayBuffer = await fontFileBold.arrayBuffer();

/*
 * IBM Plex Mono엔 한글 글리프가 없어 제목에 한글이 섞이면 satori가 .notdef 박스(□)를
 * 그대로 그려 넣는다. Noto Sans KR을 실제 제목 텍스트로만 서브셋 요청해서(구글 폰트
 * text= 파라미터) 필요한 글리프만 가져오고, satori가 폰트 이름과 무관하게 문자 단위로
 * 커버 가능한 폰트를 자동 선택하게 둔다(요소에 fontFamily를 지정하지 않았기 때문에 가능).
 * Node의 기본 User-Agent로 요청하면 구글이 TTF를 내려준다(WOFF2는 satori가 못 읽는다).
 */
async function fetchKoreanFontSubset(
    text: string,
    weight: 400 | 700,
): Promise<ArrayBuffer | undefined> {
    if (!text) return undefined;

    const cssUrl = `https://fonts.googleapis.com/css2?family=Noto+Sans+KR:wght@${weight}&text=${encodeURIComponent(text)}`;
    const css = await (await fetch(cssUrl)).text();

    const match = css.match(/src: url\((.+?)\) format\('(?:truetype|opentype)'\)/);
    if (!match) return undefined;

    return await (await fetch(match[1])).arrayBuffer();
}

export default async function GetFonts(text: string = "") {
    const [koreanRegular, koreanBold] = await Promise.all([
        fetchKoreanFontSubset(text, 400),
        fetchKoreanFontSubset(text, 700),
    ]);

    return { fontRegular, fontBold, koreanRegular, koreanBold };
};
