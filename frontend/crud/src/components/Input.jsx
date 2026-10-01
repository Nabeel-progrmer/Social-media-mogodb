import { Input as AntInput } from "antd";

const Input = ({
  placeholder,
  type = "text",
  onChange,
  value,
  name,
  required,
}) => {
  return type === "password" ? (
    <AntInput.Password
      name={name}
      placeholder={placeholder}
      value={value}
      onChange={onChange}
      required={required}
    />
  ) : (
    <AntInput
      name={name}
      type={type}
      placeholder={placeholder}
      value={value}
      onChange={onChange}
      required={required}
    />
  );
};

export default Input;
