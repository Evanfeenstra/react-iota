
# react-iota

React component for interacting with the iota protocol.

<img src="https://raw.githubusercontent.com/Evanfeenstra/react-iota/master/src/fonts/react-iota-wallet.png" height="150" />

```npm i --save react-iota```

**react-iota** is implemented as a higher-order component that passes state and actions down to its child. In the package you will find a default development wallet that you can use to make simple transactions on the tangle.
```jsx
import {IotaProvider, Wallet, Curl} from "react-iota"

class App extends Component {
  render(){
    return (<IotaProvider>
      <Wallet />
    </IotaProvider>)
  }
}
```
You can replace the ```<Wallet />``` component with your own wallet UI, and let the ```<IotaProvider />``` do all the work of interacting with the tangle.