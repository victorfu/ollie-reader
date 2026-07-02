import airportImage from "../../assets/travel/airport.jpg";
import attractionsImage from "../../assets/travel/attractions.jpg";
import beforeDepartureImage from "../../assets/travel/before-departure.jpg";
import foodImage from "../../assets/travel/food.jpg";
import goingHomeImage from "../../assets/travel/going-home.jpg";
import helpImage from "../../assets/travel/help.jpg";
import hotelImage from "../../assets/travel/hotel.jpg";
import mandaiImage from "../../assets/travel/mandai.jpg";
import planeImage from "../../assets/travel/plane.jpg";
import sentosaImage from "../../assets/travel/sentosa.jpg";
import shoppingImage from "../../assets/travel/shopping.jpg";
import transportImage from "../../assets/travel/transport.jpg";
import type { TravelTopic } from "../../types/travelEnglish";

const topicVisuals: Record<
  string,
  {
    gradient: string;
    accent: string;
    image: string;
    alt: string;
    objectPosition?: string;
    credit: string;
    sourceUrl: string;
  }
> = {
  "before-departure": {
    gradient: "from-violet-100 via-white to-sky-100 dark:from-violet-950 dark:via-base-200 dark:to-sky-950",
    accent: "bg-violet-500",
    image: beforeDepartureImage,
    alt: "Parent packing a child's suitcase with clothes and a toy plane before the trip",
    objectPosition: "center",
    credit: "Familydestinationsguide.com Images / CC BY 2.0",
    sourceUrl: "https://commons.wikimedia.org/wiki/File:Father_Packing_Kid%27s_Luggage_for_Holiday.jpg",
  },
  airport: {
    gradient: "from-sky-100 via-white to-emerald-100 dark:from-sky-950 dark:via-base-200 dark:to-emerald-950",
    accent: "bg-sky-500",
    image: airportImage,
    alt: "Airport check-in counters with travelers preparing luggage before departure",
    objectPosition: "center",
    credit: "Russianroulette2004 / CC BY-SA 3.0",
    sourceUrl: "https://commons.wikimedia.org/wiki/File:Changit3checkin.jpg",
  },
  plane: {
    gradient: "from-blue-100 via-white to-cyan-100 dark:from-blue-950 dark:via-base-200 dark:to-cyan-950",
    accent: "bg-blue-500",
    image: planeImage,
    alt: "Airplane economy cabin with rows of seats for in-flight English practice",
    objectPosition: "center",
    credit: "N509FZ / CC BY-SA 4.0",
    sourceUrl: "https://commons.wikimedia.org/wiki/File:Economy_class_interior_of_B-6528_(20230329094242).jpg",
  },
  transport: {
    gradient: "from-green-100 via-white to-sky-100 dark:from-green-950 dark:via-base-200 dark:to-sky-950",
    accent: "bg-green-500",
    image: transportImage,
    alt: "Singapore MRT platform for public transport directions and ticket questions",
    objectPosition: "center",
    credit: "S5A-0043 / CC BY 4.0",
    sourceUrl: "https://commons.wikimedia.org/wiki/File:(SGP-Singapore)_Tanjong_Rhu_MRT_Station_Platform_A_2024-06-23.jpg",
  },
  hotel: {
    gradient: "from-amber-100 via-white to-orange-100 dark:from-amber-950 dark:via-base-200 dark:to-orange-950",
    accent: "bg-amber-500",
    image: hotelImage,
    alt: "Hotel lobby seating area for check-in and service requests",
    objectPosition: "center",
    credit: "Basile Morin / CC BY-SA 4.0",
    sourceUrl: "https://commons.wikimedia.org/wiki/File:Lobby_hall_with_couches_and_chandelier_at_The_Fullerton_Bay_Hotel_Singapore.jpg",
  },
  food: {
    gradient: "from-orange-100 via-white to-yellow-100 dark:from-orange-950 dark:via-base-200 dark:to-yellow-950",
    accent: "bg-orange-500",
    image: foodImage,
    alt: "Busy Singapore hawker centre food stalls for ordering meals and drinks",
    objectPosition: "center",
    credit: "Kbseah / CC BY-SA 4.0",
    sourceUrl: "https://commons.wikimedia.org/wiki/File:Newton_Food_Centre_food_stalls.jpg",
  },
  attractions: {
    gradient: "from-purple-100 via-white to-pink-100 dark:from-purple-950 dark:via-base-200 dark:to-pink-950",
    accent: "bg-purple-500",
    image: attractionsImage,
    alt: "Gardens by the Bay Supertree Grove for sightseeing and photo requests",
    objectPosition: "center",
    credit: "Mustang Joe / CC0",
    sourceUrl: "https://commons.wikimedia.org/wiki/File:Supertree_Grove,_Gardens_by_the_Bay,_Singapore1.jpg",
  },
  shopping: {
    gradient: "from-pink-100 via-white to-rose-100 dark:from-pink-950 dark:via-base-200 dark:to-rose-950",
    accent: "bg-pink-500",
    image: shoppingImage,
    alt: "Singapore shopping mall interior for asking prices, sizes, and checkout phrases",
    objectPosition: "center",
    credit: "Basile Morin / CC BY-SA 4.0",
    sourceUrl: "https://commons.wikimedia.org/wiki/File:Large_interior_view_of_Plaza_Singapura_Shopping_mall_Orchard_Road_Singapore.jpg",
  },
  sentosa: {
    gradient: "from-cyan-100 via-white to-fuchsia-100 dark:from-cyan-950 dark:via-base-200 dark:to-fuchsia-950",
    accent: "bg-cyan-500",
    image: sentosaImage,
    alt: "Universal Studios Singapore rotating globe at the park entrance on Sentosa",
    objectPosition: "center",
    credit: "Moheen Reeyad / CC BY-SA 4.0",
    sourceUrl: "https://commons.wikimedia.org/wiki/File:Universal_Studios_Singapore_globe_(125026).jpg",
  },
  mandai: {
    gradient: "from-emerald-100 via-white to-lime-100 dark:from-emerald-950 dark:via-base-200 dark:to-lime-950",
    accent: "bg-emerald-500",
    image: mandaiImage,
    alt: "White tigers in water at Singapore Zoo for Mandai wildlife vocabulary",
    objectPosition: "center",
    credit: "Basile Morin / CC BY-SA 4.0",
    sourceUrl: "https://commons.wikimedia.org/wiki/File:Two_white_tigers_playing_in_the_water_at_Singapore_Zoo.jpg",
  },
  help: {
    gradient: "from-red-100 via-white to-orange-100 dark:from-red-950 dark:via-base-200 dark:to-orange-950",
    accent: "bg-red-500",
    image: helpImage,
    alt: "Airport information counter for asking for help while traveling",
    objectPosition: "center",
    credit: "LN9267 / CC BY-SA 4.0",
    sourceUrl: "https://commons.wikimedia.org/wiki/File:Singapore_Changi_Airport_Terminal_4_information_counter_18-05-2024.jpg",
  },
  "going-home": {
    gradient: "from-rose-100 via-white to-indigo-100 dark:from-rose-950 dark:via-base-200 dark:to-indigo-950",
    accent: "bg-rose-500",
    image: goingHomeImage,
    alt: "Singapore Airlines A380 parked at a Changi Airport gate ready for the flight home",
    objectPosition: "center",
    credit: "Bahnfrend / CC BY-SA 4.0",
    sourceUrl: "https://commons.wikimedia.org/wiki/File:Singapore_Airlines_Airbus_A380_9V-SKN_Singapore_2024_(01).jpg",
  },
};

const fallbackVisual = topicVisuals.airport;

interface TopicSceneVisualProps {
  topic: TravelTopic;
  size?: "card" | "hero";
}

export function TopicSceneVisual({ topic, size = "card" }: TopicSceneVisualProps) {
  const visual = topicVisuals[topic.id] ?? fallbackVisual;
  const isHero = size === "hero";

  return (
    <figure
      className={`relative overflow-hidden rounded-2xl bg-gradient-to-br ${visual.gradient} ${
        isHero ? "min-h-[240px] sm:min-h-[300px]" : "min-h-[150px]"
      }`}
    >
      <img
        src={visual.image}
        alt={visual.alt}
        className="absolute inset-0 h-full w-full object-cover"
        style={{ objectPosition: visual.objectPosition }}
        loading="eager"
        decoding="async"
      />
      <div className="absolute inset-0 bg-gradient-to-t from-black/28 via-black/0 to-white/10 dark:from-black/42 dark:to-black/10" />
      <div className={`absolute left-5 top-5 h-1.5 w-16 rounded-full ${visual.accent}`} />
      {isHero && (
        <figcaption className="absolute bottom-3 left-3 max-w-[calc(100%-1.5rem)] rounded-lg bg-black/45 px-2.5 py-1 text-[11px] leading-tight text-white/82 backdrop-blur-sm">
          Photo:{" "}
          <a
            href={visual.sourceUrl}
            target="_blank"
            rel="noreferrer"
            className="underline-offset-2 hover:underline focus-visible:focus-ring"
          >
            {visual.credit}
          </a>
        </figcaption>
      )}
    </figure>
  );
}
