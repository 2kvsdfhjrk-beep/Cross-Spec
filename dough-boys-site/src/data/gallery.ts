/* Photos for the gallery page and the sideways gallery on the homepage. */
import type { ImageMetadata } from 'astro';
import doublePepperoni from '../assets/img/gallery/double-pepperoni.jpg';
import kioskNight from '../assets/img/gallery/kiosk-night.jpg';
import hotMeatSun from '../assets/img/gallery/hot-meat-sun.jpg';
import queue from '../assets/img/gallery/queue.jpg';
import hotMeatSliced from '../assets/img/gallery/hot-meat-sliced.jpg';
import kioskDay from '../assets/img/gallery/kiosk-day.jpg';

export interface Photo { slug: string; img: ImageMetadata; caption: string; meta: string; alt: string }

export const photos: Photo[] = [
  { slug: 'double-pepperoni', img: doublePepperoni, caption: 'Double Pepperoni', meta: '£14',
    alt: 'A Double Pepperoni in its box: cupped pepperoni, melted cheese and a charred crust' },
  { slug: 'kiosk-night', img: kioskNight, caption: 'Busy night at the kiosk', meta: 'Evenings',
    alt: 'A crowd outside the Dough Boys kiosk at dusk, with balloons and the Just Good Pizza awning lit up' },
  { slug: 'hot-meat-sun', img: hotMeatSun, caption: 'Hot Meat', meta: '£15',
    alt: 'A Hot Meat pizza in sunlight: chorizo, sausage, jalapeños and melted cheese' },
  { slug: 'queue', img: queue, caption: 'Worth the queue', meta: 'The kiosk',
    alt: 'People queueing at the Dough Boys kiosk window under the Just Good Pizza awning' },
  { slug: 'hot-meat-sliced', img: hotMeatSliced, caption: 'Sliced and ready', meta: 'Hot Meat',
    alt: 'A sliced Hot Meat pizza in its box with jalapeños, chorizo and sausage' },
  { slug: 'kiosk-day', img: kioskDay, caption: 'Look for the banners', meta: 'NR30 3JG',
    alt: 'The Dough Boys kiosk in daylight with two Dough Boys banners and an A-board out front' },
];
