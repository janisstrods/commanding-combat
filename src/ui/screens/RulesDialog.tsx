// The rules dialog. A placeholder until the in-app rules reference arrives with the battle screen (Task 11).
import { Button, Modal } from '../kit';

export function RulesDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <Modal open={open} title="Rules" onClose={onClose} width={620} footer={<Button onClick={onClose}>Close</Button>}>
      <div className="rules-placeholder">
        <p>
          <b>The full rules reference is still being written.</b> It will open here, and from the battle screen, with
          every Order, Action, Event and terrain type explained in plain words.
        </p>
        <p>The game in a nutshell:</p>
        <ul>
          <li>
            Each side has its own deck of <b>Fate cards</b>. A card can be played as an <b>Order</b> on your turn
            (Fire, Move, Advance, Recover, Rout, Artillery…) or as an <b>Action</b> in answer to something, and it may
            carry an <b>Event</b> that happens when the card is drawn for a die roll.
          </li>
          <li>
            There are no dice: every roll is the top card of a Fate deck. Some cards trigger <b>Time</b>, which moves
            the game clock toward its sudden end.
          </li>
          <li>
            You score victory points by holding <b>objectives</b>, eliminating enemy units and exiting units off the
            enemy&rsquo;s edge. When a side&rsquo;s losses reach its surrender level, it gives up.
          </li>
          <li>
            You can only give a few Orders per turn, and the cards in your hand decide which. Plan with what you hold,
            and keep a card back to answer your opponent.
          </li>
        </ul>
      </div>
    </Modal>
  );
}
