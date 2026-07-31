import { describe, it, expect } from "vitest";
import type { ProfileTrack } from "@only-g/shared-types/artist-profile";
import {
  youtubeEmbed,
  spotifyEmbed,
  trackUrl,
  trackEmbed,
  platformsDisponibles,
} from "./embeds";

const YT_ID = "dQw4w9WgXcQ"; // exactamente 11 caracteres
const SP_ID = "6rqhFgbbKwnb9MLmUQDhG6";

describe("youtubeEmbed", () => {
  it.each([
    `https://www.youtube.com/watch?v=${YT_ID}`,
    `https://youtu.be/${YT_ID}`,
    `https://www.youtube.com/shorts/${YT_ID}`,
    `https://www.youtube.com/embed/${YT_ID}`,
  ])("traduce %s a la URL de embed", (url) => {
    expect(youtubeEmbed(url)).toBe(`https://www.youtube.com/embed/${YT_ID}`);
  });
  it("devuelve null si no es un link de YouTube", () => {
    expect(youtubeEmbed("https://example.com/foo")).toBeNull();
    expect(youtubeEmbed("")).toBeNull();
  });
});

describe("spotifyEmbed", () => {
  it("traduce track y respeta el prefijo intl-", () => {
    expect(spotifyEmbed(`https://open.spotify.com/track/${SP_ID}`)).toBe(
      `https://open.spotify.com/embed/track/${SP_ID}`,
    );
    expect(spotifyEmbed(`https://open.spotify.com/intl-es/track/${SP_ID}`)).toBe(
      `https://open.spotify.com/embed/track/${SP_ID}`,
    );
  });
  it("soporta album/playlist/episode", () => {
    expect(
      spotifyEmbed("https://open.spotify.com/album/1DFixLWuPkv3KT3TnV35m3"),
    ).toBe("https://open.spotify.com/embed/album/1DFixLWuPkv3KT3TnV35m3");
  });
  it("devuelve null si no es Spotify", () => {
    expect(spotifyEmbed("https://example.com/track/x")).toBeNull();
  });
});

describe("trackUrl / trackEmbed", () => {
  const track: ProfileTrack = {
    title: "Demo",
    youtubeUrl: `https://youtu.be/${YT_ID}`,
    spotifyUrl: `https://open.spotify.com/track/${SP_ID}`,
  };
  it("trackUrl elige el link crudo de la plataforma", () => {
    expect(trackUrl(track, "youtube")).toBe(`https://youtu.be/${YT_ID}`);
    expect(trackUrl(track, "spotify")).toBe(
      `https://open.spotify.com/track/${SP_ID}`,
    );
  });
  it("trackEmbed traduce a embed y da null si falta el link", () => {
    expect(trackEmbed(track, "youtube")).toBe(
      `https://www.youtube.com/embed/${YT_ID}`,
    );
    expect(trackEmbed({ title: "sin links" }, "youtube")).toBeNull();
  });
});

describe("platformsDisponibles", () => {
  it("lista solo las plataformas con al menos un tema reproducible", () => {
    const tracks: ProfileTrack[] = [
      { title: "a", youtubeUrl: `https://youtu.be/${YT_ID}` },
      { title: "b", spotifyUrl: `https://open.spotify.com/track/${SP_ID}` },
    ];
    expect(platformsDisponibles(tracks)).toEqual(["youtube", "spotify"]);
    expect(
      platformsDisponibles([
        { title: "c", youtubeUrl: `https://youtu.be/${YT_ID}` },
      ]),
    ).toEqual(["youtube"]);
    expect(platformsDisponibles([{ title: "d" }])).toEqual([]);
  });
});
