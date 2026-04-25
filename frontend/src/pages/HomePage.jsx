import { useNavigate } from 'react-router-dom';
import { Button } from '@mui/material';

function HomePage() {

    const navigate = useNavigate();

    const goToChat = (chat) => {
        navigate(`/chatjosu${chat}`);
    }

    return (
        <div>
            <h2>Welcome JOM Peich</h2>

            <Button variant="contained" color="primary" onClick={() => goToChat(1)}>
                Go to Chat v1
            </Button>
            <br />
            <br />
            <Button variant="contained" color="primary" onClick={() => goToChat(2)}>
                Go to Chat v2
            </Button>
            <br />
            <br />
            <Button variant="contained" color="primary" onClick={() => goToChat(3)}>
                Go to Chat v3
            </Button>
        </div>
    );
}
export default HomePage;