type LoaderProps = {
  className?: string;
};

const Loader = ({ className = "" }: LoaderProps) => {
  return (
    <div
      className={`inline-flex items-center justify-center ${className}`}
      aria-label="Loading"
    >
      <div className="h-8 w-8 animate-spin rounded-full border-2 border-blue-500/20 border-t-blue-500" />
    </div>
  );
};

export default Loader;

