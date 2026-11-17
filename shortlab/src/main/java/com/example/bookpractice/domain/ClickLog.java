package com.example.bookpractice.domain;

import java.time.LocalDateTime;

public record ClickLog(Long id, LocalDateTime clickedAt) {
}