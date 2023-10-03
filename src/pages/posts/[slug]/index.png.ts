import type { APIRoute } from "astro";
import { getCollection, type CollectionEntry } from "astro:content";
import { slug as slugger } from "github-slugger";
import { ImageResponse } from "@vercel/og";
import {DEFAULT_OG_IMG_SIZE} from "@utils/Constants";
import GetOgFonts from "@utils/GetOgFonts";

export const GET: APIRoute = async ({ props }) => {
  const { post } = props as { post: CollectionEntry<"posts"> };
  
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
                  tw: "flex mb-24 text-4xl justify-center items-center",
                  children: [
                    {
                      type: "div",
                      props: {
                        style: {
                          width: "16",
                          height: "16",
                          background: "black"
                        }
                      }
                    },
                    {
                      type: "span",
                      props: {
                        tw: "ml-4",
                        children: "jaehee.dev"
                      }
                    }
                  ],
                }
              },
              {
                type: "div",
                props: {
                  tw: "text-5xl font-bold",
                  style: { 
                    color: "black",
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
      ],
    },
  );
};
  
export async function getStaticPaths () {
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
