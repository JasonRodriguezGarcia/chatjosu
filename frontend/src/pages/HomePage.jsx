import { useNavigate } from 'react-router-dom';
import { Button } from '@mui/material';

function HomePage() {

    const navigate = useNavigate();

    const goToChat = () => {
        navigate("/chatjosu");
    }

  return (
    <div>
      <h2>Welcome JOM Peich</h2>

      <Button variant="contained" color="primary" onClick={goToChat}>
        Go to Chat
      </Button>
    </div>
  );
}
export default HomePage;