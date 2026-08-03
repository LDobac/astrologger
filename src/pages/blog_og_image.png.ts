import type { APIRoute } from "astro";
import {
  DEFAULT_OG_IMG_SIZE,
  OG_IMG_BACKGROUND_PATTERN,
  OG_IMG_PALETTE,
} from "@utils/Constants";
import GetOgFonts from "@utils/GetOgFonts";
import RenderOgPng from "@utils/RenderOgPng";

export const GET: APIRoute = async () => {
  const { fontRegular, fontBold } = await GetOgFonts();

  const png = await RenderOgPng(
    {
      type: "div",
      props: {
        style: {
          display: "flex",
          width: "100%",
          height: "100%",
          justifyContent: "center",
          alignItems: "center",
          backgroundColor: OG_IMG_PALETTE.background,
          color: OG_IMG_PALETTE.foreground,
          ...OG_IMG_BACKGROUND_PATTERN,
        },
        children: {
          type: "div",
          props: {
            style: {
              display: "flex",
              flexDirection: "column",
              textAlign: "center",
              alignItems: "center",
            },
            children: [
              {
                type: "div",
                props: {
                  style: {
                    display: "flex",
                    fontSize: "60px", // text-6xl
                    justifyContent: "center",
                    alignItems: "center",
                  },
                  children: [
                    {
                      type: "div",
                      props: {
                        style: {
                          marginTop: "24px", // mt-6
                          width: "24px",
                          height: "24px",
                          background: OG_IMG_PALETTE.accent
                        }
                      }
                    },
                    {
                      type: "span",
                      props: {
                        style: {
                          marginLeft: "16px", // ml-4
                          fontWeight: 700, // font-bold
                        },
                        children: "jaehee.dev"
                      }
                    }
                  ],
                }
              }
            ]
          }
        }
      },
    },
    {
      width: DEFAULT_OG_IMG_SIZE.width,
      height: DEFAULT_OG_IMG_SIZE.height,
      fonts: [
        {
          name: "IBM Plex Mono",
          data: fontRegular,
          weight: 400,
          style: "normal",
        },
        {
          name: "IBM Plex Mono",
          data: fontBold,
          weight: 600,
          style: "normal",
        },
      ],
    },
  );

  return new Response(png, {
    headers: {
      "Content-Type": "image/png",
    },
  });
};
