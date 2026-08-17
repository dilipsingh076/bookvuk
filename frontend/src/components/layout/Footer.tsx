const Footer = () => {
  return (
    <footer className="border-t border-booknest-border bg-white">
      <div className="w-full px-4 py-8 text-sm text-booknest-muted">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div className="font-semibold text-booknest-navy">BookNest</div>
          <div className="flex gap-4">
            <a href="#" className="hover:text-booknest-navy">
              Terms of Service
            </a>
            <a href="#" className="hover:text-booknest-navy">
              Privacy Policy
            </a>
            <a href="#" className="hover:text-booknest-navy">
              Admin Login
            </a>
          </div>
        </div>
        <div className="mt-2">© {new Date().getFullYear()} BookNest. All rights reserved.</div>
      </div>
    </footer>
  );
};

export default Footer;

