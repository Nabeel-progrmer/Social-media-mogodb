const BrandLoader = ({ label = "Loading your circle" }) => (
  <div className="brand-loader" role="status" aria-live="polite">
    <div className="loader-logo">
      <span className="brand-dot" /> circle
    </div>
    <div className="loader-spinner" aria-hidden="true" />
    <p>{label}</p>
  </div>
);

export default BrandLoader;
