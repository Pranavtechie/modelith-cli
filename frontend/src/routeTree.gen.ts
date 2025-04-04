/* eslint-disable */

// @ts-nocheck

// noinspection JSUnusedGlobalSymbols

// This file was automatically generated by TanStack Router.
// You should NOT make any changes in this file as it will be overwritten.
// Additionally, you should also exclude this file from your linter and/or formatter to prevent it from being checked or modified.

// Import Routes

import { Route as rootRoute } from './routes/__root'
import { Route as SimilarityMatrixImport } from './routes/similarity-matrix'
import { Route as IndexImport } from './routes/index'
import { Route as DetailsPairImport } from './routes/details.$pair'

// Create/Update Routes

const SimilarityMatrixRoute = SimilarityMatrixImport.update({
  id: '/similarity-matrix',
  path: '/similarity-matrix',
  getParentRoute: () => rootRoute,
} as any)

const IndexRoute = IndexImport.update({
  id: '/',
  path: '/',
  getParentRoute: () => rootRoute,
} as any)

const DetailsPairRoute = DetailsPairImport.update({
  id: '/details/$pair',
  path: '/details/$pair',
  getParentRoute: () => rootRoute,
} as any)

// Populate the FileRoutesByPath interface

declare module '@tanstack/react-router' {
  interface FileRoutesByPath {
    '/': {
      id: '/'
      path: '/'
      fullPath: '/'
      preLoaderRoute: typeof IndexImport
      parentRoute: typeof rootRoute
    }
    '/similarity-matrix': {
      id: '/similarity-matrix'
      path: '/similarity-matrix'
      fullPath: '/similarity-matrix'
      preLoaderRoute: typeof SimilarityMatrixImport
      parentRoute: typeof rootRoute
    }
    '/details/$pair': {
      id: '/details/$pair'
      path: '/details/$pair'
      fullPath: '/details/$pair'
      preLoaderRoute: typeof DetailsPairImport
      parentRoute: typeof rootRoute
    }
  }
}

// Create and export the route tree

export interface FileRoutesByFullPath {
  '/': typeof IndexRoute
  '/similarity-matrix': typeof SimilarityMatrixRoute
  '/details/$pair': typeof DetailsPairRoute
}

export interface FileRoutesByTo {
  '/': typeof IndexRoute
  '/similarity-matrix': typeof SimilarityMatrixRoute
  '/details/$pair': typeof DetailsPairRoute
}

export interface FileRoutesById {
  __root__: typeof rootRoute
  '/': typeof IndexRoute
  '/similarity-matrix': typeof SimilarityMatrixRoute
  '/details/$pair': typeof DetailsPairRoute
}

export interface FileRouteTypes {
  fileRoutesByFullPath: FileRoutesByFullPath
  fullPaths: '/' | '/similarity-matrix' | '/details/$pair'
  fileRoutesByTo: FileRoutesByTo
  to: '/' | '/similarity-matrix' | '/details/$pair'
  id: '__root__' | '/' | '/similarity-matrix' | '/details/$pair'
  fileRoutesById: FileRoutesById
}

export interface RootRouteChildren {
  IndexRoute: typeof IndexRoute
  SimilarityMatrixRoute: typeof SimilarityMatrixRoute
  DetailsPairRoute: typeof DetailsPairRoute
}

const rootRouteChildren: RootRouteChildren = {
  IndexRoute: IndexRoute,
  SimilarityMatrixRoute: SimilarityMatrixRoute,
  DetailsPairRoute: DetailsPairRoute,
}

export const routeTree = rootRoute
  ._addFileChildren(rootRouteChildren)
  ._addFileTypes<FileRouteTypes>()

/* ROUTE_MANIFEST_START
{
  "routes": {
    "__root__": {
      "filePath": "__root.tsx",
      "children": [
        "/",
        "/similarity-matrix",
        "/details/$pair"
      ]
    },
    "/": {
      "filePath": "index.tsx"
    },
    "/similarity-matrix": {
      "filePath": "similarity-matrix.tsx"
    },
    "/details/$pair": {
      "filePath": "details.$pair.tsx"
    }
  }
}
ROUTE_MANIFEST_END */
