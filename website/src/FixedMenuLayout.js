import React, { Component } from 'react';
import {
  BrowserRouter as Router,
  Routes,
  Route,
  Link,
  useLocation,
} from "react-router-dom";
import {
  Container,
  Image,
  Menu,
  Dropdown,
} from 'semantic-ui-react'
import { Auth } from 'aws-amplify';

import { Home } from './home.js';
import { Models } from './models.js';
import { AdminModels } from './admin/models.js';
import { AdminCars } from './admin/cars.js';
import { AdminActivation } from './admin/generate_activation.js';
import { Upload } from './upload.js';

function cwr(operation, payload){
  // Instrument Routing to Record Page Views
  // https://github.com/aws-observability/aws-rum-web/blob/main/docs/cdn_react.md
  return void 0;
};

function usePageViews() {
  let location = useLocation();
  React.useEffect(() => {
    console.log(location.pathname);
    cwr("recordPageView", location.pathname);
  }, [location]);
}

function MenuRoutes() {
  usePageViews();
  return <Routes>
    <Route path="/models" element={<Models />} />
    <Route path="/upload" element={<Upload />} />
    <Route path="/admin/models" element={<AdminModels />} />
    <Route path="/admin/cars" element={<AdminCars />} />
    <Route path="/admin/generate_activation" element={<AdminActivation />} />
    <Route exact path="/" element={<Home />} />
  </Routes>;
}

class FixedMenuLayout extends Component {
  constructor(props) {
    super(props);
    this.containerDiv = React.createRef();
    this.state = {
      groups: []
    };
  }
  _isMounted = false;

  componentDidMount() {
    this._isMounted = true;

    Auth.currentAuthenticatedUser().then(user => {
      // Returns an array of groups
      const groups = user.signInUserSession.accessToken.payload["cognito:groups"];
      console.log("User Groups: ")
      console.log(groups)
      if (this._isMounted && groups !== undefined ) {
        this.setState({ groups: groups })
      }
    })
  }

  componentWillUnmount() {
    this._isMounted = false;
  }

  componentDidCatch(error, info) {
    console.log(error);
    cwr('recordError', error);
  };

  render() {
    if(this.state.groups.includes('admin')){
      var menuAdminDropdown = <React.Fragment>
        <Dropdown item simple text='Admin'>
          <Dropdown.Menu>
            <Dropdown.Item as={Link} to='/admin/models'>Models</Dropdown.Item>
            <Dropdown.Item as={Link} to='/admin/cars'>Cars</Dropdown.Item>
            <Dropdown.Item as={Link} to='/admin/generate_activation'>Generate Activation</Dropdown.Item>
          </Dropdown.Menu>
        </Dropdown>
      </React.Fragment>
    }
  
    return (
      <div>
        <Router>
          <Menu fixed='top' inverted>
            <Container>
              <Menu.Item as={Link} to='/' header>
                <Image size='mini' src='/logo.png' style={{ marginRight: '1.5em' }} />
                DREM
              </Menu.Item>
              <Menu.Item as={Link} name='Upload' to='/upload' ></Menu.Item>
              <Menu.Item as={Link} name='Models' to='/models'></Menu.Item>
              {menuAdminDropdown}

              <Menu.Menu position='right'>
                <Menu.Item as='a' name={this.props.user}></Menu.Item>
                <Menu.Item as='a' name='Sign Out' onClick={this.props.signout}></Menu.Item>
              </Menu.Menu>
            </Container>
          </Menu>

          <Container text style={{ marginTop: '7em' }}>
            <MenuRoutes />
          </Container>
        </Router>
      </div>
    )
  }
}

export default FixedMenuLayout