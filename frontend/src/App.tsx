import { Routes, Route, useLocation, Link as RouterLink } from "react-router-dom";
import {
  Box,
  Container,
  Flex,
  HStack,
  Link,
} from "@chakra-ui/react";
import { ColorModeButton } from "./components/ui/color-mode";
import { ScenesPage } from "./pages/ScenesPage";
import { CharactersPage } from "./pages/CharactersPage";
import { LocationsPage } from "./pages/LocationsPage";
import { VariablesPage } from "./pages/VariablesPage";
import { ImportPage } from "./pages/ImportPage";

const navItems = [
  { path: "/", label: "Scenes", end: true },
  { path: "/characters", label: "Characters" },
  { path: "/locations", label: "Locations" },
  { path: "/variables", label: "Variables" },
  { path: "/import", label: "Import & Generate" },
];

function NavItem({ path, label, end }: { path: string; label: string; end?: boolean }) {
  const location = useLocation();
  const isActive = end ? location.pathname === path : location.pathname.startsWith(path);

  return (
    <Link
      asChild
      px={3}
      py={1.5}
      rounded="md"
      fontWeight="500"
      fontSize="sm"
      color={isActive ? "accent.DEFAULT" : "fg.muted"}
      bg={isActive ? "bg.subtle" : "transparent"}
      position="relative"
      _hover={{
        color: "fg.DEFAULT",
        bg: "bg.subtle",
        textDecoration: "none",
      }}
      css={
        isActive
          ? {
              "&::after": {
                content: '""',
                position: "absolute",
                bottom: "-1px",
                left: "50%",
                transform: "translateX(-50%)",
                width: "24px",
                height: "2px",
                backgroundColor: "var(--chakra-colors-accent-DEFAULT)",
                borderRadius: "1px",
              },
            }
          : undefined
      }
    >
      <RouterLink to={path}>{label}</RouterLink>
    </Link>
  );
}

function App() {
  return (
    <Box minH="100vh" display="flex" flexDirection="column" bg="bg.DEFAULT">
      {/* Header */}
      <Box
        as="header"
        bg="bg.panel"
        borderBottomWidth="1px"
        borderColor="border.DEFAULT"
        position="sticky"
        top={0}
        zIndex={100}
        py={2}
        px={4}
      >
        {/* Navigation */}
        <Flex as="nav" justify="center" align="center" position="relative">
          <HStack gap={0}>
            {navItems.map((item) => (
              <NavItem key={item.path} {...item} />
            ))}
          </HStack>
          
          {/* Color Mode Toggle */}
          <Box position="absolute" right={0}>
            <ColorModeButton size="sm" />
          </Box>
        </Flex>
      </Box>

      {/* Main Content */}
      <Box as="main" flex={1} py={4} px={4}>
        <Container maxW="container.xl">
          <Routes>
            <Route path="/" element={<ScenesPage />} />
            <Route path="/characters" element={<CharactersPage />} />
            <Route path="/locations" element={<LocationsPage />} />
            <Route path="/variables" element={<VariablesPage />} />
            <Route path="/import" element={<ImportPage />} />
          </Routes>
        </Container>
      </Box>
    </Box>
  );
}

export default App;
