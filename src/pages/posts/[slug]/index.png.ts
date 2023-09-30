import type { APIRoute } from "astro";
import { getCollection, type CollectionEntry } from "astro:content";
import { slug as slugger } from "github-slugger";
import { ImageResponse } from "@vercel/og";

const GetFonts = async () => {
  const fontFileRegular = await fetch(
    "https://www.1001fonts.com/download/font/ibm-plex-mono.regular.ttf"
  );
  const fontRegular: ArrayBuffer = await fontFileRegular.arrayBuffer();

  const fontFileBold = await fetch(
    "https://www.1001fonts.com/download/font/ibm-plex-mono.bold.ttf"
  );
  const fontBold: ArrayBuffer = await fontFileBold.arrayBuffer();

  return { fontRegular, fontBold };
};

export const GET: APIRoute = async ({ props }) => {
  const { post } = props as { post: CollectionEntry<"posts"> };
  
  const { fontRegular, fontBold } = await GetFonts();

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
      width: 1200,
      height: 630,
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