import { Button as AntButton } from 'antd';

const Button = ({ onClick, children, type = "primary" }) => {
    return (
        <AntButton htmlType="submit" type={type} onClick={onClick}>
            {children}
        </AntButton>
    )
}


export default  Button