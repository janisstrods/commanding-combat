// Credits and the fan-edition notice.
import { Button } from '../kit';
import { navigate } from '../routes';
import './screens.css';

export function Credits() {
  return (
    <div className="page-root kit-desk">
      <article className="page-sheet kit-paper">
        <header className="page-head">
          <h2 className="page-title">Credits</h2>
          <Button variant="ghost" size="sm" onClick={() => navigate({ kind: 'menu' })}>
            ← Menu
          </Button>
        </header>
        <section className="credits">
          <p>
            An unofficial, fan-made digital edition of <i>Combat Commander: Europe</i>, designed by Chad Jensen and
            published by GMT Games. Combat Commander is a trademark of GMT Games LLC. This edition is not affiliated with
            or endorsed by GMT Games; please support the publisher by buying the game.
          </p>
          <h3>What is ours, and what is data</h3>
          <p>
            All artwork (the painted maps, counters, markers and card faces) was made for this edition. The rules, card
            and scenario texts are our own paraphrases and summaries. Names, numbers and terrain facts (which hex holds
            which terrain, the counters&rsquo; values, the Fate decks&rsquo; contents) are game data, transcribed with
            the help of the free VASSAL module.
          </p>
          <h3>Fonts</h3>
          <p>
            Oswald (Vernon Adams, Kalapi Gajjar, Cyreal) and Source Sans 3 (Paul D. Hunt, Adobe), both under the SIL Open
            Font License 1.1.
          </p>
          <h3>Made with</h3>
          <p>TypeScript, React and Vite. Sounds are synthesized in the browser; there are no audio files.</p>
        </section>
      </article>
    </div>
  );
}
