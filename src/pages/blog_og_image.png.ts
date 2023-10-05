import type { APIRoute } from "astro";
import { ImageResponse } from "@vercel/og";
import {DEFAULT_OG_IMG_SIZE} from "@utils/Constants";
import GetOgFonts from "@utils/GetOgFonts";

export const GET: APIRoute = async () => {
  const { fontRegular, fontBold } = await GetOgFonts();

  return new ImageResponse(
    {
      type: "div",
      props: {
        tw: "flex w-full h-full bg-white justify-center items-center",
        style: {
          backgroundImage: "radial-gradient(circle at 25px 25px, lightgray 3%, transparent 0%), radial-gradient(circle at 75px 75px, lightgray 3%, transparent 0%)",
          backgroundSize: "100px 100px",
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
                          background: "black"
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
 
