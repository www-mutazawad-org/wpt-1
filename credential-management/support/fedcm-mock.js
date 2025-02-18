import { RequestIdTokenStatus, LogoutRpsStatus, FederatedAuthRequest, FederatedAuthRequestReceiver } from '/gen/third_party/blink/public/mojom/webid/federated_auth_request.mojom.m.js';

function toMojoIdTokenStatus(status) {
  return RequestIdTokenStatus["k" + status];
}

// A mock service for responding to federated auth requests.
export class MockFederatedAuthRequest {
  constructor() {
    this.receiver_ = new FederatedAuthRequestReceiver(this);
    this.interceptor_ = new MojoInterfaceInterceptor(FederatedAuthRequest.$interfaceName);
    this.interceptor_.oninterfacerequest = e => {
        this.receiver_.$.bindHandle(e.handle);
    }
    this.interceptor_.start();
    this.idToken_ = null;
    this.status_ = RequestIdTokenStatus.kError;
    this.logoutRpsStatus_ = LogoutRpsStatus.kError;
    this.returnPending_ = false;
    this.pendingPromiseResolve_ = null;
  }

  // Causes the subsequent `navigator.credentials.get()` to resolve with the token.
  returnIdToken(token) {
    this.status_ = RequestIdTokenStatus.kSuccess;
    this.idToken_ = token;
    this.returnPending_ = false;
  }

  // Causes the subsequent `navigator.credentials.get()` to reject with the error.
  returnError(error) {
    if (error == "Success")
      throw new Error("Success is not a valid error");
    this.status_ = toMojoIdTokenStatus(error);
    this.idToken_ = null;
    this.returnPending_ = false;
  }

  // Causes the subsequent `navigator.credentials.get()` to return a pending promise
  // that can be cancelled using `cancelTokenRequest()`.
  returnPendingPromise() {
    this.returnPending_ = true;
  }

  logoutRpsReturn(status) {
    let validated = LogoutRpsStatus[status];
    if (validated === undefined)
      throw new Error("Invalid status: " + status);
    this.logoutRpsStatus_ = validated;
  }

  // Implements
  //   RequestIdToken(url.mojom.Url provider, string id_request) => (RequestIdTokenStatus status, string? id_token);
  async requestIdToken(provider, idRequest) {
    if (this.returnPending_) {
      this.pendingPromise_ = new Promise((resolve, reject) => {
        this.pendingPromiseResolve_ = resolve;
      });
      return this.pendingPromise_;
    }
    return Promise.resolve({
      status: this.status_,
      idToken: this.idToken_
    });
  }

  async cancelTokenRequest() {
    this.pendingPromiseResolve_({
      status: toMojoIdTokenStatus("ErrorCanceled"),
      idToken: null
    });
    this.pendingPromiseResolve_ = null;
  }

  async logoutRps(logout_endpoints) {
    return Promise.resolve({
      status: this.logoutRpsStatus_
    });
  }

  async reset() {
    this.idToken_ = null;
    this.status_ = RequestIdTokenStatus.kError;
    this.logoutRpsStatus_ = LogoutRpsStatus.kError;
    this.receiver_.$.close();
    this.interceptor_.stop();

    // Clean up and reset mock stubs asynchronously, so that the blink side
    // closes its proxies and notifies JS sensor objects before new test is
    // started.
    await new Promise(resolve => { step_timeout(resolve, 0); });
  }
}
