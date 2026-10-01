import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Alert,
  Avatar,
  Button,
  Card,
  Empty,
  Input,
  Layout,
  Pagination,
  Skeleton,
  Typography,
} from "antd";
import {
  ArrowRightOutlined,
  MessageOutlined,
  TeamOutlined,
} from "@ant-design/icons";
import Header from "../components/Header";
import { baseUrl } from "../core";
import { store } from "../store/states";
import "../App.css";

const { Content } = Layout;
const { Text, Title } = Typography;
const pageSize = 24;

const fullName = (person) =>
  [person.firstname, person.lastname].filter(Boolean).join(" ");

const People = () => {
  const navigate = useNavigate();
  const currentUser = store((state) => state.user);
  const [query, setQuery] = useState("");
  const [users, setUsers] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    const timer = window.setTimeout(async () => {
      setIsLoading(true);
      setError("");
      try {
        const params = new URLSearchParams({
          page: String(page),
          limit: String(pageSize),
        });
        if (query.trim()) params.set("q", query.trim());
        const response = await fetch(`${baseUrl}/api/v1/users?${params}`, {
          headers: {
            Authorization: `Bearer ${localStorage.getItem("token") || ""}`,
          },
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.message || "Could not load people");
        if (!cancelled) {
          setUsers(data.users || []);
          setTotal(data.total || 0);
        }
      } catch (requestError) {
        if (!cancelled) setError(requestError.message);
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }, query.trim() ? 220 : 0);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [page, query]);

  const groups = users.reduce((result, person) => {
    const letter = fullName(person).trim().charAt(0).toLocaleUpperCase() || "#";
    (result[letter] ||= []).push(person);
    return result;
  }, {});

  return (
    <Layout className="app-layout">
      <Header />
      <Content className="dashboard-content people-page-content">
        <section className="people-page-heading">
          <div>
            <Text className="eyebrow">THE CIRCLE DIRECTORY</Text>
            <Title level={1}>People</Title>
            <Text type="secondary">
              Find members and visit their profiles.
            </Text>
          </div>
          <div className="people-count" aria-live="polite">
            <TeamOutlined />
            <strong>{total.toLocaleString()}</strong>
            <span>{total === 1 ? "member" : "members"}</span>
          </div>
        </section>

        <section className="people-directory" aria-label="Member directory">
          <div className="people-search-row">
            <Input.Search
              aria-label="Search members by name"
              placeholder="Search by first or last name"
              value={query}
              allowClear
              enterButton
              loading={isLoading}
              onChange={(event) => {
                setQuery(event.target.value);
                setPage(1);
              }}
              onSearch={(value) => {
                setQuery(value);
                setPage(1);
              }}
            />
            <Text type="secondary">Alphabetical order</Text>
          </div>

          {error && (
            <Alert
              className="people-error"
              type="error"
              showIcon
              message={error}
            />
          )}

          {isLoading ? (
            <div className="people-loading-grid" aria-label="Loading people">
              {Array.from({ length: 6 }, (_, index) => (
                <Card className="people-card" key={index}>
                  <Skeleton active avatar paragraph={{ rows: 1 }} />
                </Card>
              ))}
            </div>
          ) : users.length === 0 ? (
            <Empty
              className="people-empty"
              image={Empty.PRESENTED_IMAGE_SIMPLE}
              description={query.trim() ? "No members match that name." : "No members to show yet."}
            />
          ) : (
            <div className="people-groups">
              {Object.entries(groups).map(([letter, members]) => (
                <section className="people-letter-group" key={letter}>
                  <h2>{letter}</h2>
                  <div className="people-grid">
                    {members.map((person) => {
                      const isSelf = String(person._id) === String(currentUser?._id);
                      return (
                        <Card className="people-card" key={person._id}>
                          <div className="people-card-person">
                            <Avatar
                              className="people-avatar"
                              src={person.profilePicture || undefined}
                              onError={() => true}
                            >
                              {person.firstname?.[0] || "U"}
                              {person.lastname?.[0] || ""}
                            </Avatar>
                            <div className="people-card-name">
                              <strong>{fullName(person)}</strong>
                              {isSelf && <Text type="secondary">You</Text>}
                            </div>
                          </div>
                          <div className="people-card-actions">
                            <Button
                              type="link"
                              className="people-profile-link"
                              onClick={() =>
                                navigate(isSelf ? "/profile" : `/profile/${person._id}`)
                              }
                            >
                              View profile <ArrowRightOutlined />
                            </Button>
                            {!isSelf && (
                              <Button
                                aria-label={`Message ${fullName(person)}`}
                                icon={<MessageOutlined />}
                                onClick={() => navigate(`/chat?userId=${person._id}`)}
                              />
                            )}
                          </div>
                        </Card>
                      );
                    })}
                  </div>
                </section>
              ))}
            </div>
          )}

          {!isLoading && total > pageSize && (
            <Pagination
              className="people-pagination"
              current={page}
              pageSize={pageSize}
              total={total}
              showSizeChanger={false}
              showTotal={(count, range) => `${range[0]}-${range[1]} of ${count}`}
              onChange={setPage}
            />
          )}
        </section>
      </Content>
    </Layout>
  );
};

export default People;