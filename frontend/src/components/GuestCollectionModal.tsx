import Modal from "./ui/Modal";

type GuestCollectionModalProps = {
  isOpen: boolean;
  onClose: () => void;
  /** Opens the main login modal after this dialog closes */
  onSignIn: () => void;
};

const GuestCollectionModal = ({ isOpen, onClose, onSignIn }: GuestCollectionModalProps) => {
  const handleSignIn = () => {
    onClose();
    onSignIn();
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose}>
      <div className="relative p-6 pt-12 sm:p-8 sm:pt-14">
        <button
          type="button"
          onClick={onClose}
          aria-label="Close dialog"
          className="absolute right-3 top-3 inline-flex h-9 w-9 items-center justify-center rounded-full text-booknest-muted transition-colors hover:bg-booknest-lilac hover:text-booknest-navy sm:right-4 sm:top-4"
        >
          <span aria-hidden className="text-xl leading-none">
            ×
          </span>
        </button>
        <h2 id="guest-collection-title" className="text-lg font-bold text-booknest-navy">
          Explore the collection
        </h2>
        <p
          className="mt-3 text-sm leading-relaxed text-booknest-muted"
          id="guest-collection-desc"
        >
          To browse our full collection of books and discover amazing reads, please sign in to your
          account. New here? You can create one in a moment from the sign-in screen.
        </p>
        <div className="mt-8 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-booknest-border px-4 py-2.5 text-sm font-semibold text-booknest-navy transition-colors hover:bg-booknest-lilac"
          >
            Close
          </button>
          <button
            type="button"
            onClick={handleSignIn}
            className="rounded-xl bg-booknest-purple px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-booknest-purple-hover"
          >
            Sign in
          </button>
        </div>
      </div>
    </Modal>
  );
};

export default GuestCollectionModal;
