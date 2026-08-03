export const PAGE_SIZE = 12;

export const DESC_LEN = 230;

export const DEFAULT_OG_IMG_SIZE = {
    width: 1200,
    height: 630
}

/*
 * 생성 썸네일/OG 이미지 팔레트.
 *
 * 썸네일은 빌드타임 정적 에셋이라 런타임에 테마별로 교체할 수 없다. 예전처럼 흰 배경을 쓰면
 * 다크모드에서 포스트 상단 전체 너비에 1200x630 흰 블록이 남으므로, 라이트/다크 어느 쪽에
 * 놓아도 무난한 어두운 중립 톤 하나로 통일한다. SNS 공유용 OG 이미지도 같은 팔레트를 쓴다.
 */
export const OG_IMG_PALETTE = {
    background: "#22272e",
    foreground: "#f0f6fc",
    accent: "#4493f8",
    pattern: "#3d444d",
}

export const OG_IMG_BACKGROUND_PATTERN = {
    backgroundImage:
        `radial-gradient(circle at 25px 25px, ${OG_IMG_PALETTE.pattern} 3%, transparent 0%), ` +
        `radial-gradient(circle at 75px 75px, ${OG_IMG_PALETTE.pattern} 3%, transparent 0%)`,
    backgroundSize: "100px 100px",
}
