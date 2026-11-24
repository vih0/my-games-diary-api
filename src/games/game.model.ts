export enum GameStatus {
  Wishlist = 'wishlist',
  Playing = 'playing',
  Played = 'played',
  Completed = 'completed',
}

export interface Game {
  id: string;
  name: string;
  status: GameStatus;
  progress: number;
  favorite: boolean;
  completed: boolean;
  platform: string;
  genre: string | null;
  rating: number | null;
  imageUrl: string | null;
  notes: string | null;
}
