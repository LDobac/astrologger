import type { APIRoute } from "astro";
import { ImageResponse } from "@vercel/og";
import {
  DEFAULT_OG_IMG_SIZE,
  OG_IMG_BACKGROUND_PATTERN,
  OG_IMG_PALETTE,
} from "@utils/Constants";
import GetOgFonts from "@utils/GetOgFonts";

export const GET: APIRoute = async () => {
  const { fontRegular, fontBold } = await GetOgFonts();

  return new ImageResponse(
    {
      type: "div",
      props: {
        tw: "flex w-full h-full justify-center items-center",
        style: {
          backgroundColor: OG_IMG_PALETTE.background,
          color: OG_IMG_PALETTE.foreground,
          ...OG_IMG_BACKGROUND_PATTERN,
        },
        children: {
          type: "div",
          props: {
            tw: "flex flex-col text-center items-center",
            children: [
              {
                type: "div",
                props: {
                  tw: "flex text-6xl justify-center items-center",
                  children: [
                    {
                      type: "div",
                      props: {
                        tw: "mt-6",
                        style: {
                          width: "24",
                          height: "24",
                          background: OG_IMG_PALETTE.accent
                        }
                      }
                    },
                    {
                      type: "span",
                      props: {
                        tw: "ml-4 font-bold",
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
};
 
