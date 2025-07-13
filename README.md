# matterbridge-daikin-ac

[![npm version](https://img.shields.io/npm/v/matterbridge-daikin-ac.svg)](https://www.npmjs.com/package/matterbridge-daikin-ac)
[![npm downloads](https://img.shields.io/npm/dt/matterbridge-daikin-ac.svg)](https://www.npmjs.com/package/matterbridge-daikin-ac)
![Node.js CI](https://github.com/andrasg/matterbridge-daikin-ac/actions/workflows/build-matterbridge-plugin.yml/badge.svg)

[![power by](https://img.shields.io/badge/powered%20by-matterbridge-blue)](https://www.npmjs.com/package/matterbridge)

A [matterbridge](https://github.com/Luligu/matterbridge) plugin allowing connecting Daikin AC devices to Matter.

The plugin uses local connection to Daikin Wifi modules. The plugin does not work with Daikin cloud (Onecta) connected devices.

## Installation

Install this plugin using the matterbridge web UI by typing `matter-daikin-ac` into the Install plugins section and clicking the Install button.

> Don't forget to restart matterbridge afterwards.

## Configuration

The plugin needs the IP address of the wifi module. Optionally, you can suffix the config with `,useGetToPost` to enable support for older devices that do not use http POST.
