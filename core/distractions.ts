/**
 * THE DEFAULT DISTRACTION LIST
 *
 * Built from what productivity blockers report people block most (Freedom's most-blocked list,
 * Focus's category lists, workplace blocking guides) and the sites that break flow for students:
 * feeds, video, streaming, games, shopping, and refresh-loop news.
 *
 * Each entry has the domain (used when we know the exact URL: browser helper, macOS) and the
 * names the site uses in its page titles (used to recognise it from a Windows browser's window
 * title when the helper isn't installed). Things people often need for work or school, such as
 * email, LinkedIn, Spotify, Wikipedia and Medium, are deliberately left off. Users can add them.
 */
export interface DistractionSite { domain: string; names: string[]; category: string }

export const DISTRACTION_CATALOG: DistractionSite[] = [
  // Social feeds
  { domain: "youtube.com", names: ["YouTube", "YouTube Music"], category: "video" },
  { domain: "instagram.com", names: ["Instagram", "Instagram photos and videos"], category: "social" },
  { domain: "tiktok.com", names: ["TikTok"], category: "social" },
  { domain: "x.com", names: ["X"], category: "social" },
  { domain: "twitter.com", names: ["Twitter"], category: "social" },
  { domain: "facebook.com", names: ["Facebook"], category: "social" },
  { domain: "reddit.com", names: ["Reddit"], category: "social" },
  { domain: "snapchat.com", names: ["Snapchat"], category: "social" },
  { domain: "pinterest.com", names: ["Pinterest"], category: "social" },
  { domain: "tumblr.com", names: ["Tumblr"], category: "social" },
  { domain: "threads.net", names: ["Threads"], category: "social" },
  { domain: "threads.com", names: ["Threads"], category: "social" },
  { domain: "bsky.app", names: ["Bluesky"], category: "social" },
  { domain: "discord.com", names: ["Discord"], category: "social" },
  { domain: "9gag.com", names: ["9GAG"], category: "social" },
  { domain: "imgur.com", names: ["Imgur"], category: "social" },

  // Video + streaming
  { domain: "twitch.tv", names: ["Twitch"], category: "video" },
  { domain: "kick.com", names: ["Kick"], category: "video" },
  { domain: "netflix.com", names: ["Netflix"], category: "streaming" },
  { domain: "hulu.com", names: ["Hulu"], category: "streaming" },
  { domain: "disneyplus.com", names: ["Disney+", "Disney Plus"], category: "streaming" },
  { domain: "max.com", names: ["Max", "HBO Max"], category: "streaming" },
  { domain: "primevideo.com", names: ["Prime Video"], category: "streaming" },
  { domain: "crunchyroll.com", names: ["Crunchyroll"], category: "streaming" },
  { domain: "peacocktv.com", names: ["Peacock"], category: "streaming" },
  { domain: "paramountplus.com", names: ["Paramount+", "Paramount Plus"], category: "streaming" },
  { domain: "tv.apple.com", names: ["Apple TV", "Apple TV+"], category: "streaming" },

  // Games
  { domain: "roblox.com", names: ["Roblox"], category: "games" },
  { domain: "chess.com", names: ["Chess.com"], category: "games" },
  { domain: "lichess.org", names: ["Lichess", "lichess.org"], category: "games" },
  { domain: "coolmathgames.com", names: ["Coolmath Games", "Cool Math Games"], category: "games" },
  { domain: "poki.com", names: ["Poki"], category: "games" },
  { domain: "crazygames.com", names: ["CrazyGames"], category: "games" },
  { domain: "miniclip.com", names: ["Miniclip"], category: "games" },
  { domain: "store.steampowered.com", names: ["Steam"], category: "games" },
  { domain: "epicgames.com", names: ["Epic Games Store", "Epic Games"], category: "games" },

  // Shopping
  { domain: "amazon.com", names: ["Amazon", "Amazon.com"], category: "shopping" },
  { domain: "ebay.com", names: ["eBay"], category: "shopping" },
  { domain: "etsy.com", names: ["Etsy"], category: "shopping" },
  { domain: "shein.com", names: ["SHEIN"], category: "shopping" },
  { domain: "temu.com", names: ["Temu"], category: "shopping" },
  { domain: "aliexpress.com", names: ["AliExpress"], category: "shopping" },

  // News, sports and refresh-loop sites
  { domain: "cnn.com", names: ["CNN", "CNN Politics", "CNN Business"], category: "news" },
  { domain: "foxnews.com", names: ["Fox News"], category: "news" },
  { domain: "buzzfeed.com", names: ["BuzzFeed"], category: "news" },
  { domain: "nytimes.com", names: ["The New York Times"], category: "news" },
  { domain: "dailymail.co.uk", names: ["Daily Mail Online", "Daily Mail"], category: "news" },
  { domain: "tmz.com", names: ["TMZ"], category: "news" },
  { domain: "espn.com", names: ["ESPN"], category: "news" },
  { domain: "bleacherreport.com", names: ["Bleacher Report"], category: "news" },
  { domain: "news.ycombinator.com", names: ["Hacker News"], category: "news" },
];

export const DEFAULT_DISTRACTIONS = DISTRACTION_CATALOG.map((s) => s.domain);

/** Bump when the default list grows; existing installs get the new sites merged in once. */
export const DEFAULTS_VERSION = 2;

const byDomain = new Map(DISTRACTION_CATALOG.map((s) => [s.domain, s]));
export function catalogEntry(domain: string) { return byDomain.get(domain); }
