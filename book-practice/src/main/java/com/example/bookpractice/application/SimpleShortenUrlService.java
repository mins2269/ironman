package com.example.bookpractice.application;

import com.example.bookpractice.domain.ClickLogRepository;
import com.example.bookpractice.domain.ShortenUrl;
import com.example.bookpractice.domain.ShortenUrlRepository;
import com.example.bookpractice.domain.exception.DuplicateShortenUrlKeyException;
import com.example.bookpractice.domain.exception.InvalidOriginalUrlException;
import com.example.bookpractice.domain.exception.LackOfShortenUrlKeyException;
import com.example.bookpractice.domain.exception.NotFoundShortenUrlException;
import com.example.bookpractice.infrastructure.clicklog.ClickLogEntity;
import com.example.bookpractice.infrastructure.clicklog.ClickLogJpaRepository;
import com.example.bookpractice.presentation.dto.ShortenUrlCreateRequestDto;
import com.example.bookpractice.presentation.dto.ShortenUrlCreateResponseDto;
import com.example.bookpractice.presentation.dto.ShortenUrlInformationDto;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import java.net.URI;
import java.net.URISyntaxException;
import java.time.LocalDateTime;
import java.time.ZoneId;
import java.util.List;
import java.util.Set;

@Service
public class SimpleShortenUrlService {

    private ShortenUrlRepository shortenUrlRepository;
    private ClickLogRepository clickLogRepository;
    private static final Set<String> RESERVED = Set.of("shortenurl", "assets", "error", "index", "favicon");

    @Autowired
    SimpleShortenUrlService(ShortenUrlRepository shortenUrlRepository, ClickLogRepository clickLogRepository) {
        this.shortenUrlRepository = shortenUrlRepository;
        this.clickLogRepository = clickLogRepository;
    }

    public ShortenUrlCreateResponseDto generateShortenUrl(
            ShortenUrlCreateRequestDto shortenUrlCreateRequestDto)
    {
        String key;

        if (shortenUrlCreateRequestDto.getAlias() != null) {
            key = checkedAlias(shortenUrlCreateRequestDto.getAlias());
        }

        else {
            String original = shortenUrlCreateRequestDto.getOriginalUrl();
            validateUri(original);
            key = getUniqueShortenUrlKey();
        }

        // 새로운 단축 url 만들고 저장
        ShortenUrl shortenUrl = new ShortenUrl(shortenUrlCreateRequestDto.getOriginalUrl(),key);
        shortenUrlRepository.saveShortenUrl(shortenUrl);

        ShortenUrlCreateResponseDto shortenUrlCreateResponseDto = new ShortenUrlCreateResponseDto(shortenUrl);
        return shortenUrlCreateResponseDto;
    }

    // check 별칭
    private String checkedAlias(String alias) {
        if (RESERVED.contains(alias.toLowerCase()) || shortenUrlRepository.existsByShortenUrlKey(alias)) {
            throw new DuplicateShortenUrlKeyException();
        }
        return alias;
    }
    // 입력 경로 검사
    private void validateUri(String originalUrl){
        try {
            new URI(originalUrl);
        } catch (URISyntaxException e){
            throw new InvalidOriginalUrlException();
        }
    }
    // unique 단축 url 생성
    private String getUniqueShortenUrlKey() {
        final int MAX_RETRY_COUNT = 5;
        int count = 0;

        while(count ++ < MAX_RETRY_COUNT){
            String shortenUrlKey = ShortenUrl.generateShortenUrlKey();
            ShortenUrl shortenUrl = shortenUrlRepository.findShortenUrlByShortenUrlKey(
                    shortenUrlKey);

            if(shortenUrl == null){
                return shortenUrlKey;
            }
        }
        throw new LackOfShortenUrlKeyException();
    }

    /// 리다이렉트
    public String getOriginalUrlByShortenUrlKey(String shortenUrlKey){
        ShortenUrl shortenUrl = shortenUrlRepository.findShortenUrlByShortenUrlKey(shortenUrlKey);

        if(shortenUrl == null){
            throw new NotFoundShortenUrlException();
        }
        // 접속 횟수는 DB에서 원자적으로 증가 (읽기→더하기→저장 방식은 동시 요청에서 유실됨)
        shortenUrlRepository.incrementRedirectCount(shortenUrlKey);

        try {
            clickLogRepository.save(shortenUrlKey, LocalDateTime.now(ZoneId.of("Asia/Seoul")));
        } catch (RuntimeException e) { }

        return shortenUrl.getOriginalUrl();
    }

    // 접속 기록 조회 메서드 추가
    public List<LocalDateTime> getRecentClicks(String key) {
        return clickLogRepository.findRecentClickedAt(key);
    }

    public ShortenUrlInformationDto getShortenUrlInforamtionByShortenUrlKey(String shortenUrlKey){
        ShortenUrl shortenUrl1 = shortenUrlRepository.findShortenUrlByShortenUrlKey(shortenUrlKey);

        if(shortenUrl1 == null){
            throw new NotFoundShortenUrlException();
        }

        ShortenUrlInformationDto shortenUrlInformationDto = new ShortenUrlInformationDto(shortenUrl1);

        return shortenUrlInformationDto;
    }

}
