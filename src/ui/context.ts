import { type Actor, type State } from "../domain/model";
import { type Command } from "../domain/commands";
export interface UI {
  s: State;
  actor: Actor;
  busy: boolean;
  run: (c: Command, blob?: Blob) => Promise<string | true | false>;
  go: (path: string) => void;
  client: (customerId: string, path?: string) => void;
  notify: (text: string, error?: boolean) => void;
}
