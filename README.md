# Lively Offchain

This project provides a user management, blog, notification, airdrop, and reports services.

## Description

Lively Off-chain provides services on Web 2.0 and Web 3.0 technologies. so it implements services for Web 2.0 which provides a lot of web API
and it implements also services to interact with smart contracts on the Polygon blockchain network. it doesn't have any UI for provided services.

the user management, blog, reports, and notification services provide web (2.0) API but an airdrop is a hybrid service that provides web API and it interacts with smart contracts to transfer tokens and it fetches data from social media platforms such as Twitter, Instagram, Telegram and etc to observe users' actions according to airdrop instructions.

<!--
*** An in-depth paragraph about your project and overview of use.
*** [![Product Name Screen Shot][product-screenshot]](https://example.com)
*** Here's a blank template to get started: To avoid retyping too much info. Do a search and replace with your text editor for the following:
*** `github_username`, `repo_name`, `twitter_handle`, `linkedin_username`, `email_client`, `email`, `project_title`, `project_description`
-->

## Getting Started

### Dependencies

Nodejs >= 18

Yarn

Nestjs

Typescript

Postgresql

Redis

### Prerequisites

 first, install yarn and don't use npm because it couldn't resolve dependencies correctly.
* yarn
  ```sh
  npm install yarn@latest -g
  ```

### Installing
  ```sh
  git clone https://github.com/Livelyverse/lively-offchain.git
  cd lively-offchain
  yarn install
  ```

### Executing program

```sh
yarn build
yarn start 
```

## Usage

After launch, it, checks API with swagger with address http://localhost:3001/api


## Help

* Build problem
  ```
  node_modules/@ethersproject/providers/src.ts/json-rpc-provider.ts:159:14 - error TS2612: 
  Property 'provider' will overwrite the base property in 'Signer'. If this is intentional, add an initializer. 
  Otherwise, add a 'declare' modifier or remove the redundant declaration.

  159     readonly provider: JsonRpcProvider;
  ```
  go to node_modules/@ethersproject/providers/src.ts/json-rpc-provider.ts file and add declare to first of line 159 as follow
  ```
  declare readonly provider: JsonRpcProvider;
  ```

## Contributing

Contributions are what make the open source community such an amazing place to learn, inspire, and create. Any contributions you make are **greatly appreciated**.

If you have a suggestion that would make this better, please fork the repo and create a pull request. You can also simply open an issue with the tag "enhancement".
Don't forget to give the project a star! Thanks again!

1. Fork the Project
2. Create your Feature Branch (`git checkout -b feature/AmazingFeature`)
3. Commit your Changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the Branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request


## Authors
Sina Tadayon https://github.com/SinaTadayon

Mansour Farabi https://github.com/MFarabi

<!--
## Version History

* 0.2
    * Various bug fixes and optimizations
    * See [commit change]() or See [release history]()
* 0.1
    * Initial Release
-->

## License

[MIT](https://github.com/Livelyverse/lively-offchain/blob/master/LICENSE)


<!-- ACKNOWLEDGMENTS 
## Acknowledgments

* []()
* []()
* []()
-->

