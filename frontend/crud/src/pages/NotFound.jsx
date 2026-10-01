import { Button, Result } from "antd";
import { Link } from "react-router-dom";

const NotFound = () => {
  return (
    <main className="auth-page">
      <Result
        status="404"
        title="This page wandered off."
        subTitle="The space you are looking for does not exist."
        extra={
          <Link to="/">
            <Button type="primary">Back to the feed</Button>
          </Link>
        }
      />
    </main>
  );
};

export default NotFound;
