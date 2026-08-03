import type { APIRoute } from "astro";
import { getCollection, type CollectionEntry } from "astro:content";
import { slug as slugger } from "github-slugger";
import {
  DEFAULT_OG_IMG_SIZE,
  OG_IMG_BACKGROUND_PATTERN,
  OG_IMG_PALETTE,
} from "@utils/Constants";
import GetOgFonts from "@utils/GetOgFonts";
import RenderOgPng from "@utils/RenderOgPng";

export const GET: APIRoute = async ({ props }) => {
  const { post } = props as { post: CollectionEntry<"posts"> };

  const { fontRegular, fontBold, koreanRegular, koreanBold } = await GetOgFonts(post.data.title);

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
                    marginBottom: "96px", // mb-24
                    fontSize: "36px", // text-4xl
                    justifyContent: "center",
                    alignItems: "center",
                  },
                  children: [
                    {
                      type: "div",
                      props: {
                        style: {
                          width: "16px",
                          height: "16px",
                          background: OG_IMG_PALETTE.accent
                        }
                      }
                    },
                    {
                      type: "span",
                      props: {
                        style: {
                          marginLeft: "16px", // ml-4
                        },
                        children: "jaehee.dev"
                      }
                    }
                  ],
                }
              },
              {
                type: "div",
                props: {
                  style: {
                    fontSize: "48px", // text-5xl
                    fontWeight: 700, // font-bold
                    color: OG_IMG_PALETTE.foreground,
                  },
                  children: post.data.title,
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
        ...(koreanRegular
          ? [{ name: "Noto Sans KR", data: koreanRegular, weight: 400 as const, style: "normal" as const }]
          : []),
        ...(koreanBold
          ? [{ name: "Noto Sans KR", data: koreanBold, weight: 700 as const, style: "normal" as const }]
          : []),
      ],
    },
  );

  return new Response(png, {
    headers: {
      "Content-Type": "image/png",
    },
  });
};

export async function getStaticPaths() {
  const posts = await getCollection("posts");
  const links = posts.map((post) => {
    return {
      params: {
        slug: slugger(post.data.title)
      },
      props: {
        post
      }
    };
  });

  return links;
}
