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

export default async function GetFonts() 
{
    return { fontRegular, fontBold };
};
