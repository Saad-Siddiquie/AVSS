import { render, screen } from '@testing-library/react';
import Home from './page';

describe('Home page', () => {
  it('renders the dashboard heading', () => {
    render(<Home />);
    expect(screen.getByText(/Autonomous Video Surveillance System/i)).toBeInTheDocument();
  });
});
