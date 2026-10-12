/* Background videos. Phones get the 540px-wide copies; larger screens get the 720px originals.
   Importing with ?url gives each file a content hash, so it can be cached for a year. */
import premisesMp4 from '../assets/media/premises.mp4?url';
import premisesWebm from '../assets/media/premises.webm?url';
import premisesMp4M from '../assets/media/premises-m.mp4?url';
import premisesWebmM from '../assets/media/premises-m.webm?url';
import ovenMp4 from '../assets/media/oven.mp4?url';
import ovenWebm from '../assets/media/oven.webm?url';
import ovenMp4M from '../assets/media/oven-m.mp4?url';
import ovenWebmM from '../assets/media/oven-m.webm?url';
import dessertMp4 from '../assets/media/dessert.mp4?url';
import dessertWebm from '../assets/media/dessert.webm?url';
import dessertMp4M from '../assets/media/dessert-m.mp4?url';
import dessertWebmM from '../assets/media/dessert-m.webm?url';
import insideMp4 from '../assets/media/inside.mp4?url';
import insideWebm from '../assets/media/inside.webm?url';
import insideMp4M from '../assets/media/inside-m.mp4?url';
import insideWebmM from '../assets/media/inside-m.webm?url';
import premisesPoster from '../assets/media/premises-poster.webp';
import ovenPoster from '../assets/media/oven-poster.webp';
import dessertPoster from '../assets/media/dessert-poster.webp';
import insidePoster from '../assets/media/inside-poster.webp';

export const PHONE = '(max-width: 899px)';
/* exact codecs, so a browser that cannot play H.264 skips the MP4 instead of downloading it first */
const MP4_PHONE = 'video/mp4; codecs="avc1.64001F"';
const MP4 = 'video/mp4; codecs="avc1.640028"';
const WEBM = 'video/webm; codecs="vp9"';
const set = (mp4: string, webm: string, mp4M: string, webmM: string) => [
  { src: mp4M, type: MP4_PHONE, media: PHONE },
  { src: webmM, type: WEBM, media: PHONE },
  { src: mp4, type: MP4 },
  { src: webm, type: WEBM },
];

export const videos = {
  premises: { sources: set(premisesMp4, premisesWebm, premisesMp4M, premisesWebmM), poster: premisesPoster },
  oven: { sources: set(ovenMp4, ovenWebm, ovenMp4M, ovenWebmM), poster: ovenPoster },
  dessert: { sources: set(dessertMp4, dessertWebm, dessertMp4M, dessertWebmM), poster: dessertPoster },
  inside: { sources: set(insideMp4, insideWebm, insideMp4M, insideWebmM), poster: insidePoster },
};
